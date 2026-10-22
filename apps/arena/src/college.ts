import fs from "node:fs";
import path from "node:path";
import type { CollegeInfo } from "@iedc/shared";
import { site } from "@iedc/config/site";
import { DEPARTMENTS, SEMESTERS } from "@iedc/config/people";

/** The built-in values from colleges/<id>/college.ts. */
export const builtInCollege = (): CollegeInfo => ({
  brand: { ...site.brand },
  organiser: site.organiser,
  departments: [...DEPARTMENTS],
  semesters: [...SEMESTERS],
});

/**
 * College name and join-form lists as changed by the host on this laptop,
 * kept in arena-data/college.json. Without that file, the built-in profile is used.
 */
export class CollegeSettings {
  private saved: CollegeInfo | null = null;
  private file: string | null;

  constructor(dir: string | null) {
    this.file = dir ? path.join(dir, "college.json") : null;
    if (this.file && fs.existsSync(this.file)) {
      try {
        this.saved = JSON.parse(fs.readFileSync(this.file, "utf8")) as CollegeInfo;
      } catch {
        /* a broken file falls back to the built-in profile */
      }
    }
  }

  get(): CollegeInfo & { custom: boolean } {
    return { ...builtInCollege(), ...this.saved, custom: !!this.saved };
  }

  set(info: CollegeInfo) {
    this.saved = info;
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(info, null, 1));
    fs.renameSync(tmp, this.file);
  }

  reset() {
    this.saved = null;
    if (this.file) fs.rmSync(this.file, { force: true });
  }
}
