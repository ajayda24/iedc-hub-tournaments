import type { Namespace, Socket } from "socket.io";
import { vcErrors as E } from "@iedc/config/copy/vibecoding";
import { EVC, type CHelloAck, type HealthView } from "@iedc/shared/competitions/vibecoding/protocol";
import {
  cJoinSchema,
  cStudentCheckSchema,
  hostExtendSchema,
  hostMemberSchema,
  hostPhaseSchema,
  hostSettingsSchema,
  hostShowcaseSchema,
  hostSpotlightSchema,
  hostTeamSchema,
  internetSchema,
  notesSchema,
  puzzleMoveSchema,
  readySchema,
  teamCreateSchema,
  teamJoinSchema,
  teamKickSchema,
  teamRenameSchema,
  tileRefSchema,
  voteSchema,
} from "@iedc/shared/competitions/vibecoding/schemas";
import { applyAction, teamOf, type Action, type Result } from "@iedc/shared/competitions/vibecoding/rules";
import { createState, type CompetitionState, type Phase, type Settings } from "@iedc/shared/competitions/vibecoding/state";
import { hostView, personView, teamView, wallView, type RuntimeInfo } from "@iedc/shared/competitions/vibecoding/views";
import { rankTeams } from "@iedc/shared/competitions/vibecoding/scoring";
import type { WallView } from "@iedc/shared/competitions/vibecoding/protocol";
import type { Students } from "../../students";
import { CompetitionStore } from "./store";

type Ack = (res: unknown) => void;
const safeAck = (ack: unknown): Ack => (typeof ack === "function" ? (ack as Ack) : () => {});

export interface RoomDeps {
  pin: string;
  students: Students;
  /** arena-data/competitions/vibecoding */
  dir: string;
  now?: () => number;
  /** join URLs (with QR) for this competition's phone page, and whether the laptop has internet */
  network?: () => { joinUrls: WallView["joinUrls"]; laptopInternet: boolean | null };
  seed?: number;
}

interface SocketData {
  competition?: string;
  role?: "player" | "host" | "screen";
  studentId?: string;
  token?: string;
}

/**
 * The live Tile Rush event. Rules live in @iedc/shared (pure); this class owns
 * the sockets, the clock tick, saving, and (later gates) the AI, checks and sites.
 */
export class VibecodingRoom {
  readonly id = "vibecoding";
  state: CompetitionState;
  readonly store: CompetitionStore;
  private nsp!: Namespace;
  private now: () => number;
  /** studentId → socket id (one live phone per student) */
  private sockets = new Map<string, string>();
  /** students whose phone reports internet */
  readonly internet = new Set<string>();
  private sentTeams = new Map<string, number>();
  private sentPeople = new Map<string, string | null>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHostSent = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private restored = false;

  constructor(private deps: RoomDeps) {
    this.now = deps.now ?? Date.now;
    this.store = new CompetitionStore(deps.dir);
    const loaded = this.store.load();
    this.restored = !!loaded;
    this.state = loaded ?? createState(deps.seed ?? (Math.random() * 2 ** 32) >>> 0, this.now());
  }

  get wasRestored() {
    return this.restored;
  }

  /* ---------------- runtime facts ---------------- */

  health(): HealthView {
    return { safeMode: this.state.settings.safeMode, autoSafe: false, keySet: false, provider: "mock", models: [], queued: 0, inFlight: 0, asksPerMin: 0 };
  }

  runtime(): RuntimeInfo {
    const net = this.deps.network?.() ?? { joinUrls: [], laptopInternet: null };
    return {
      now: this.now(),
      online: new Set(this.sockets.keys()),
      internet: this.internet,
      health: this.health(),
      joinUrls: net.joinUrls,
      laptopInternet: net.laptopInternet,
      dataDir: this.store.dir,
    };
  }

  /* ---------------- dispatch + broadcast ---------------- */

  dispatch(action: Action): Result {
    const res = applyAction(this.state, action, { now: this.now() });
    if (res.ok) {
      if (action.type !== "tick") this.store.log(action.type, logData(action));
      this.changed();
    }
    return res;
  }

  /** Something changed: save soon and push fresh views (batched). */
  changed() {
    this.store.schedule(() => this.state);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 120);
  }

  flush(forceHost = false) {
    if (!this.nsp) return;
    const rt = this.runtime();
    const wall = wallView(this.state, rt);
    this.nsp.to(`${this.id}:all`).emit(EVC.wall, wall);
    const rankOf = new Map(rankTeams(this.state).map((r) => [r.teamId, r.rank]));
    for (const t of Object.values(this.state.teams)) {
      const key = t.version * 1000 + (rankOf.get(t.id) ?? 0);
      if (this.sentTeams.get(t.id) === key) continue;
      this.sentTeams.set(t.id, key);
      const view = teamView(this.state, t, rt, rankOf.get(t.id));
      for (const m of t.members) this.nsp.to(`${this.id}:p:${m.studentId}`).emit(EVC.team, view);
    }
    for (const [sid, p] of Object.entries(this.state.people)) {
      if (this.sentPeople.get(sid) === p.teamId) continue;
      this.sentPeople.set(sid, p.teamId);
      this.nsp.to(`${this.id}:p:${sid}`).emit(EVC.me, personView(this.state, sid));
      if (!p.teamId) this.nsp.to(`${this.id}:p:${sid}`).emit(EVC.team, null);
    }
    const now = this.now();
    if (forceHost || now - this.lastHostSent > 400) {
      this.lastHostSent = now;
      this.nsp.to(`${this.id}:hosts`).emit(EVC.host, hostView(this.state, rt));
    } else this.changed();
  }

  /** Re-send a team's view even if nothing in it changed (e.g. a member came online). */
  private resendTeam(teamId: string | null | undefined) {
    if (teamId) this.sentTeams.delete(teamId);
    this.changed();
  }

  toast(studentId: string, text: string) {
    this.nsp?.to(`${this.id}:p:${studentId}`).emit(EVC.toast, { text });
  }

  start() {
    this.tickTimer = setInterval(() => {
      const before = this.state.version;
      this.dispatch({ type: "tick" });
      if (this.state.version !== before) this.changed();
    }, 1000);
    this.tickTimer.unref?.();
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.store.close(this.state);
  }

  /** Start a brand-new run: the current one is archived, never deleted. */
  newRun() {
    const keepSettings: Settings = { ...this.state.settings, registrationLocked: false };
    const dest = this.store.archive(this.state);
    this.state = createState((Math.random() * 2 ** 32) >>> 0, this.now());
    this.state.settings = keepSettings;
    this.state.clock.durationMs = keepSettings.buildMinutes * 60_000;
    this.sentTeams.clear();
    this.sentPeople.clear();
    this.nsp?.to(`${this.id}:players`).emit(EVC.team, null);
    this.changed();
    return dest;
  }

  /* ---------------- sockets ---------------- */

  private bind(socket: Socket, studentId: string) {
    const prev = this.sockets.get(studentId);
    if (prev && prev !== socket.id) {
      const old = this.nsp.sockets.get(prev);
      if (old) {
        old.emit(EVC.bumped, { reason: "You opened the competition on another phone." });
        old.data.studentId = undefined;
        old.disconnect(true);
      }
    }
    socket.data.studentId = studentId;
    socket.join(`${this.id}:p:${studentId}`);
    this.sockets.set(studentId, socket.id);
    this.sentPeople.delete(studentId);
    this.resendTeam(this.state.people[studentId]?.teamId);
  }

  /** Called by the namespace once the socket said hello for this competition. */
  onHello(socket: Socket, hello: { role: "player" | "host" | "screen"; token?: string; pin?: string }, reply: Ack) {
    const data = socket.data as SocketData;
    if (hello.role === "host") {
      if (hello.pin !== this.deps.pin) return reply({ ok: false, error: E.wrongPin, serverNow: this.now() } satisfies CHelloAck);
      data.role = "host";
      socket.join(`${this.id}:hosts`);
      socket.join(`${this.id}:all`);
      this.attachHandlers(socket);
      reply({ ok: true, serverNow: this.now() } satisfies CHelloAck);
      this.sendInitial(socket, true);
      return;
    }
    data.role = hello.role;
    data.token = hello.token;
    socket.join(`${this.id}:all`);
    if (hello.role === "player") socket.join(`${this.id}:players`);
    this.attachHandlers(socket);
    let me = null;
    const sid = hello.token ? this.state.devices[hello.token] : undefined;
    if (hello.role === "player" && sid && this.state.people[sid]) {
      this.bind(socket, sid);
      me = personView(this.state, sid);
    }
    reply({ ok: true, serverNow: this.now(), me } satisfies CHelloAck);
    this.sendInitial(socket, false);
  }

  private sendInitial(socket: Socket, host: boolean) {
    const rt = this.runtime();
    socket.emit(EVC.wall, wallView(this.state, rt));
    if (host) socket.emit(EVC.host, hostView(this.state, rt));
    const sid = (socket.data as SocketData).studentId;
    const t = sid ? teamOf(this.state, sid) : null;
    if (t) socket.emit(EVC.team, teamView(this.state, t, rt));
  }

  onDisconnect(socket: Socket) {
    const sid = (socket.data as SocketData).studentId;
    if (sid && this.sockets.get(sid) === socket.id) {
      this.sockets.delete(sid);
      this.internet.delete(sid);
      this.resendTeam(this.state.people[sid]?.teamId);
    }
  }

  private attachHandlers(socket: Socket) {
    const data = socket.data as SocketData;
    const isHost = () => data.role === "host";
    const sid = () => data.studentId;

    /** A player action: parse, need a joined student, dispatch, ack the result. */
    const player = <T>(event: string, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, make: (studentId: string, d: T) => Action) => {
      socket.on(event, (raw: unknown, ack: unknown) => {
        const reply = safeAck(ack);
        const id = sid();
        if (!id) return reply({ ok: false, error: E.joinFirst });
        const p = schema.safeParse(raw ?? {});
        if (!p.success) return reply({ ok: false, error: E.notNow });
        reply(this.dispatch(make(id, p.data)));
      });
    };
    const host = <T>(event: string, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, run: (d: T) => unknown) => {
      socket.on(event, (raw: unknown, ack: unknown) => {
        const reply = safeAck(ack);
        if (!isHost()) return reply({ ok: false, error: E.hostOnly });
        const p = schema.safeParse(raw ?? {});
        if (!p.success) return reply({ ok: false, error: E.notNow });
        try {
          const res = run(p.data);
          reply(res ?? { ok: true });
          this.flush(true);
        } catch (e) {
          reply({ ok: false, error: e instanceof Error ? e.message : "Failed" });
        }
      });
    };
    const empty = { safeParse: (v: unknown) => ({ success: true as const, data: v }) };

    socket.on(EVC.ping, (_t: unknown, ack: unknown) => safeAck(ack)(this.now()));

    socket.on(EVC.studentCheck, (raw: unknown, ack: unknown) => {
      const reply = safeAck(ack);
      const p = cStudentCheckSchema.safeParse(raw);
      if (!p.success) return reply({ ok: false });
      reply({ ok: true, ...this.deps.students.check(p.data.studentId) });
    });

    socket.on(EVC.join, (raw: unknown, ack: unknown) => {
      const reply = safeAck(ack);
      if (data.role !== "player") return reply({ ok: false, error: E.notNow });
      const p = cJoinSchema.safeParse(raw);
      if (!p.success) return reply({ ok: false, error: E.notNow });
      const v = this.deps.students.verifyOrCreate(p.data.studentId, p.data.pin, { name: p.data.name, dept: p.data.dept, sem: p.data.sem });
      if (!v.ok) return reply({ ok: false, error: v.error, locked: v.locked });
      const { studentId, name, dept, sem, avatar, token } = p.data;
      this.dispatch({ type: "person:join", person: { studentId, name, dept, sem, avatar } });
      this.state.devices[token] = studentId;
      this.bind(socket, studentId);
      reply({ ok: true, me: personView(this.state, studentId) });
    });

    player(EVC.teamCreate, teamCreateSchema, (studentId, d) => ({ type: "team:create", studentId, name: d.name }));
    player(EVC.teamJoin, teamJoinSchema, (studentId, d) => ({ type: "team:join", studentId, code: d.code }));
    player(EVC.teamLeave, empty, (studentId) => ({ type: "team:leave", studentId }));
    player(EVC.teamKick, teamKickSchema, (studentId, d) => ({ type: "team:kick", studentId, target: d.studentId }));
    player(EVC.teamRename, teamRenameSchema, (studentId, d) => ({ type: "team:rename", studentId, name: d.name }));
    player(EVC.memberReady, readySchema, (studentId, d) => ({ type: "member:ready", studentId, ready: d.ready }));
    player(EVC.tileOpen, tileRefSchema, (studentId, d) => ({ type: "tile:open", studentId, tileId: d.tileId }));
    player(EVC.tileClose, tileRefSchema, (studentId, d) => ({ type: "tile:close", studentId, tileId: d.tileId }));
    player(EVC.notesUpdate, notesSchema, (studentId, d) => ({ type: "notes:update", studentId, notes: d.notes }));
    player(EVC.voteCast, voteSchema, (studentId, d) => ({ type: "vote", studentId, teamId: d.teamId }));
    player(EVC.puzzleMove, puzzleMoveSchema, (studentId, d) => ({ type: "puzzle:move", studentId, cell: d.cell, version: d.version }));

    socket.on(EVC.internet, (raw: unknown) => {
      const id = sid();
      const p = internetSchema.safeParse(raw);
      if (!id || !p.success) return;
      const had = this.internet.has(id);
      if (p.data.online) this.internet.add(id);
      else this.internet.delete(id);
      if (had !== p.data.online) this.resendTeam(this.state.people[id]?.teamId);
    });

    host(EVC.hostSettings, hostSettingsSchema, (d) => this.dispatch({ type: "settings", patch: d as Partial<Settings> }));
    host(EVC.hostPhase, hostPhaseSchema, (d) => this.dispatch({ type: "phase:set", phase: d.phase as Phase }));
    host(EVC.hostPause, empty, () => this.dispatch({ type: "clock:pause" }));
    host(EVC.hostResume, empty, () => this.dispatch({ type: "clock:resume" }));
    host(EVC.hostExtend, hostExtendSchema, (d) => this.dispatch({ type: "clock:extend", minutes: d.minutes }));
    host(EVC.hostMember, hostMemberSchema, (d) => this.dispatch({ type: "host:member", ...d } as Action));
    host(EVC.hostTeam, hostTeamSchema, (d) => this.hostTeam(d));
    host(EVC.hostSpotlight, hostSpotlightSchema, (d) => this.dispatch({ type: "host:spotlight", teamId: d.teamId }));
    host(EVC.hostShowcase, hostShowcaseSchema, (d) => this.dispatch({ type: "host:showcase", teamId: d.teamId, voting: d.voting }));
    host(EVC.hostNewRun, empty, () => ({ ok: true, archivedTo: this.newRun() }));
  }

  /** Host team operations. Async ones (unlock a tile) are added with the check runner. */
  protected hostTeam(d: ReturnType<typeof hostTeamSchema.parse>): Result {
    switch (d.op) {
      case "reset":
        return this.dispatch({ type: "host:resetTeam", teamId: d.teamId });
      case "remove":
        return this.dispatch({ type: "host:removeTeam", teamId: d.teamId });
      case "rename":
        return this.dispatch({ type: "host:renameTeam", teamId: d.teamId, name: d.name });
      case "message":
        return this.dispatch({ type: "host:message", teamId: d.teamId, text: d.text });
      case "glitchFire":
        return this.dispatch({ type: "host:glitch", teamId: d.teamId, fire: true });
      case "glitchCancel":
        return this.dispatch({ type: "host:glitch", teamId: d.teamId, fire: false });
      case "unlockTile":
        return { ok: false, error: E.notNow };
    }
  }

  attach(nsp: Namespace) {
    this.nsp = nsp;
  }
}

/** What goes in events.jsonl: the action minus bulky fragments. */
function logData(a: Action): Record<string, unknown> {
  const { type: _t, ...rest } = a as Record<string, unknown>;
  for (const k of ["fragment", "reference", "result"]) if (k in rest) rest[k] = "…";
  return rest;
}
