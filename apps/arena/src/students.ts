import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PIN } from "@iedc/data/rules";
import { errors } from "@iedc/data/copy/errors";
import type { StudentInfo } from "@iedc/shared";

export type { StudentInfo };

/**
 * Student registry: one record per Student ID, kept in arena-data/students.json
 * across every tournament on this laptop. PINs are stored only as salted
 * scrypt hashes — never the PIN itself.
 */
export interface StudentRecord {
  studentId: string;
  name: string;
  dept: string;
  sem: string;
  salt: string;
  pinHash: string | null;
  createdAt: number;
  pinSetAt: number | null;
  pinResetAt: number | null;
  lastSeenAt: number;
  failed: number;
  lockedUntil: number | null;
}


export type VerifyResult = { ok: true; created: boolean } | { ok: false; error: string; locked?: boolean };

export const normalizeStudentId = (raw: string) => raw.replace(/\s+/g, "").toUpperCase();

const hash = (pin: string, salt: string) => crypto.scryptSync(pin, salt, 32).toString("hex");

export class Students {
  private records = new Map<string, StudentRecord>();
  private file: string | null;

  constructor(dir: string | null, private now: () => number = Date.now) {
    this.file = dir ? path.join(dir, "students.json") : null;
    if (this.file && fs.existsSync(this.file)) {
      try {
        const list = JSON.parse(fs.readFileSync(this.file, "utf8")) as StudentRecord[];
        for (const r of list) this.records.set(r.studentId, r);
      } catch {
        /* a broken file shouldn't stop the event; it is rewritten on the next save */
      }
    }
  }

  private save() {
    if (!this.file) return;
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify([...this.records.values()], null, 1));
    fs.renameSync(tmp, this.file);
  }

  /** Does this ID already have a PIN? (drives "create" vs "enter" on the phone) */
  check(studentId: string): { exists: boolean; lockedUntil: number | null } {
    const r = this.records.get(studentId);
    const locked = r?.lockedUntil && r.lockedUntil > this.now() ? r.lockedUntil : null;
    return { exists: !!r?.pinHash, lockedUntil: locked };
  }

  /**
   * First join creates the PIN; later joins must match it.
   * Too many wrong tries lock the ID for PIN.lockMinutes.
   */
  verifyOrCreate(studentId: string, pin: string, profile: { name: string; dept: string; sem: string }): VerifyResult {
    if (!new RegExp(`^\\d{${PIN.length}}$`).test(pin)) return { ok: false, error: errors.pinFormat(PIN.length) };
    const now = this.now();
    let r = this.records.get(studentId);
    if (r?.lockedUntil && r.lockedUntil > now) {
      return { ok: false, locked: true, error: errors.pinLocked(Math.ceil((r.lockedUntil - now) / 60_000)) };
    }
    if (!r || !r.pinHash) {
      const salt = crypto.randomBytes(16).toString("hex");
      r = {
        studentId,
        ...profile,
        salt,
        pinHash: hash(pin, salt),
        createdAt: r?.createdAt ?? now,
        pinSetAt: now,
        pinResetAt: r?.pinResetAt ?? null,
        lastSeenAt: now,
        failed: 0,
        lockedUntil: null,
      };
      this.records.set(studentId, r);
      this.save();
      return { ok: true, created: true };
    }
    const given = Buffer.from(hash(pin, r.salt), "hex");
    const stored = Buffer.from(r.pinHash, "hex");
    if (!crypto.timingSafeEqual(given, stored)) {
      r.failed++;
      if (r.failed >= PIN.maxTries) {
        r.lockedUntil = now + PIN.lockMinutes * 60_000;
        r.failed = 0;
        this.save();
        return { ok: false, locked: true, error: errors.pinLocked(PIN.lockMinutes) };
      }
      this.save();
      return { ok: false, error: errors.wrongPin(PIN.maxTries - r.failed) };
    }
    Object.assign(r, profile, { failed: 0, lockedUntil: null, lastSeenAt: now });
    this.save();
    return { ok: true, created: false };
  }

  /** Host: forget the PIN so the student creates a new one on their next join. */
  resetPin(studentId: string): boolean {
    const r = this.records.get(studentId);
    if (!r) return false;
    Object.assign(r, { pinHash: null, pinResetAt: this.now(), failed: 0, lockedUntil: null });
    this.save();
    return true;
  }

  unlock(studentId: string): boolean {
    const r = this.records.get(studentId);
    if (!r) return false;
    Object.assign(r, { failed: 0, lockedUntil: null });
    this.save();
    return true;
  }

  list(): StudentInfo[] {
    return [...this.records.values()]
      .map((r) => ({
        studentId: r.studentId,
        name: r.name,
        dept: r.dept,
        sem: r.sem,
        hasPin: !!r.pinHash,
        createdAt: r.createdAt,
        pinSetAt: r.pinSetAt,
        pinResetAt: r.pinResetAt,
        lastSeenAt: r.lastSeenAt,
        lockedUntil: r.lockedUntil && r.lockedUntil > this.now() ? r.lockedUntil : null,
      }))
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }
}
