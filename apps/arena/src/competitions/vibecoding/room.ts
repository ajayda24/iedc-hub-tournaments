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
import fs from "node:fs";
import path from "node:path";
import { MODELS, checklist, type TileId } from "@iedc/shared/competitions/vibecoding/config";
import { parseAnswer } from "@iedc/shared/competitions/vibecoding/parser";
import { referenceFragment } from "@iedc/shared/competitions/vibecoding/tiles/index";
import { allPassed, variantOf } from "@iedc/shared/competitions/vibecoding/rules";
import { askSchema, hostGeminiKeySchema, hostModelSchema, saveCreateSchema, saveRestoreSchema } from "@iedc/shared/competitions/vibecoding/schemas";
import type { AskAck, CheckAck } from "@iedc/shared/competitions/vibecoding/protocol";
import { AiGateway } from "./ai/gateway";
import { GeminiProvider } from "./ai/gemini";
import { MockProvider, mockOptionsFromEnv, type MockOptions } from "./ai/mock";
import { buildPrompt } from "./ai/prompt";
import { readKey, saveKey } from "./ai/key";
import { CheckRunner } from "./checks/runner";
import { SitesServer } from "./sites";
import { buildResults, resultsCsv } from "@iedc/shared/competitions/vibecoding/export";
import { EVENT, TASKS, TILE_IDS, tileConfig, type ScoredTileId, type Variant } from "@iedc/shared/competitions/vibecoding/config";
import { compose } from "@iedc/shared/competitions/vibecoding/composer";
import { slugify } from "@iedc/shared/competitions/vibecoding/rules";
import type { PublishAck } from "@iedc/shared/competitions/vibecoding/protocol";
import type { Fragment } from "@iedc/shared/competitions/vibecoding/state";

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
  /** "mock" forces the pretend AI; "auto" (default) uses Gemini when a key is set */
  ai?: "auto" | "mock";
  mock?: MockOptions;
  checkWorkers?: number;
  /** port for published sites (default 4001); false = don't serve them */
  sitesPort?: number | false;
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
  readonly gateway: AiGateway;
  readonly runner: CheckRunner;
  private gemini: GeminiProvider;
  private mock: MockProvider;
  readonly sites: SitesServer;
  private publishing = new Set<string>();

  constructor(private deps: RoomDeps) {
    this.now = deps.now ?? Date.now;
    this.store = new CompetitionStore(deps.dir);
    const loaded = this.store.load();
    this.restored = !!loaded;
    // an Ask that was on its way to the AI when the arena stopped will never come back: free the team
    if (loaded) for (const t of Object.values(loaded.teams)) t.askPending = null;
    this.state = loaded ?? createState(deps.seed ?? (Math.random() * 2 ** 32) >>> 0, this.now());
    this.gemini = new GeminiProvider(() => readKey(this.store.dir));
    this.mock = new MockProvider({ ...mockOptionsFromEnv(), ...deps.mock });
    this.gateway = new AiGateway({
      provider: this.pickProvider(),
      models: MODELS.models,
      maxInFlight: MODELS.maxInFlight,
      timeoutMs: MODELS.timeoutMs,
      maxOutputTokens: MODELS.maxOutputTokens,
      errorPauseMs: MODELS.errorPauseMs,
      errorsBeforePause: MODELS.errorsBeforePause,
      now: this.now,
      usageFile: path.join(this.store.dir, "ai-usage.json"),
    });
    this.runner = new CheckRunner({ size: deps.checkWorkers ?? 2 });
    this.sites = new SitesServer(
      path.join(this.store.dir, "sites"),
      () =>
        this.state.teamOrder
          .map((id) => this.state.teams[id])
          .filter((t) => t?.publish)
          .map((t) => ({ slug: t.publish!.slug, team: t.name, members: t.members.map((m) => m.name) })),
      () => TASKS.event.name,
    );
  }

  /** Start serving published sites (port 4001 unless told otherwise). */
  async serveSites(host?: string) {
    const port = this.deps.sitesPort ?? Number(process.env.VC_SITES_PORT || EVENT.sitesPort);
    if (port === false) return null;
    try {
      return await this.sites.listen(port, host);
    } catch (e) {
      console.error(`  ⚠  Tile Rush sites could not start on port ${port}: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  /** Gemini when a key is set (and the mock isn't forced), else the mock AI. */
  private pickProvider() {
    const forced = (this.deps.ai ?? (process.env.VC_AI === "mock" ? "mock" : "auto")) === "mock";
    return !forced && readKey(this.store.dir) ? this.gemini : this.mock;
  }

  get keySet() {
    return !!readKey(this.store.dir);
  }

  get wasRestored() {
    return this.restored;
  }

  /* ---------------- runtime facts ---------------- */

  health(): HealthView {
    return {
      safeMode: this.state.settings.safeMode,
      autoSafe: this.gateway.down(),
      keySet: this.keySet,
      provider: this.gateway.provider.name,
      models: this.gateway.health(),
      queued: this.gateway.queued,
      inFlight: this.gateway.running,
      asksPerMin: this.gateway.asksPerMin(),
    };
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
    void this.runner.close();
    void this.sites.close();
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
        // emit(event, callback) with no payload: the callback comes first
        if (typeof raw === "function") [raw, ack] = [{}, raw];
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
        // emit(event, callback) with no payload: the callback comes first
        if (typeof raw === "function") [raw, ack] = [{}, raw];
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

    /** Like player(), for actions that wait on the AI or the check runner. */
    const playerAsync = <T>(event: string, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, run: (studentId: string, d: T) => Promise<unknown>) => {
      socket.on(event, (raw: unknown, ack: unknown) => {
        // emit(event, callback) with no payload: the callback comes first
        if (typeof raw === "function") [raw, ack] = [{}, raw];
        const reply = safeAck(ack);
        const id = sid();
        if (!id) return reply({ ok: false, error: E.joinFirst });
        const p = schema.safeParse(raw ?? {});
        if (!p.success) return reply({ ok: false, error: E.notNow });
        run(id, p.data).then(reply, (e) => reply({ ok: false, error: e instanceof Error ? e.message : "Failed" }));
      });
    };
    playerAsync(EVC.askSend, askSchema, (id, d) => this.ask(id, d.tileId, d.text));
    playerAsync(EVC.publishGo, empty, (id) => this.publish(id));
    playerAsync(EVC.checkRun, tileRefSchema, (id, d) => this.check(id, d.tileId));
    player(EVC.saveCreate, saveCreateSchema, (studentId, d) => ({ type: "save:create", studentId, tileId: d.tileId, note: d.note }));
    playerAsync(EVC.saveRestore, saveRestoreSchema, async (studentId, d) => {
      const res = this.dispatch({ type: "save:restore", studentId, tileId: d.tileId, saveId: d.saveId });
      if (res.ok && res.teamId) await this.autoCheck(res.teamId, d.tileId);
      return res;
    });
    player(EVC.hintUse, tileRefSchema, (studentId, d) => ({ type: "hint:use", studentId, tileId: d.tileId }));
    player(EVC.autosolveUse, tileRefSchema, (studentId, d) => {
      const t = teamOf(this.state, studentId);
      const v = variantOf(this.state, d.tileId);
      return {
        type: "autosolve:use",
        studentId,
        tileId: d.tileId,
        reference: referenceFragment(d.tileId, v, t?.name ?? ""),
        result: allPassed(checklist(d.tileId, v).map((i) => i.id), this.now()),
      };
    });

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
    host(EVC.hostPhase, hostPhaseSchema, (d) => {
      const res = this.dispatch({ type: "phase:set", phase: d.phase as Phase });
      if (res.ok && (d.phase === "frozen" || d.phase === "closed")) this.exportResults();
      return res;
    });
    host(EVC.hostPause, empty, () => this.dispatch({ type: "clock:pause" }));
    host(EVC.hostResume, empty, () => this.dispatch({ type: "clock:resume" }));
    host(EVC.hostExtend, hostExtendSchema, (d) => this.dispatch({ type: "clock:extend", minutes: d.minutes }));
    host(EVC.hostMember, hostMemberSchema, (d) => this.dispatch({ type: "host:member", ...d } as Action));
    host(EVC.hostTeam, hostTeamSchema, (d) => this.hostTeam(d));
    host(EVC.hostSpotlight, hostSpotlightSchema, (d) => this.dispatch({ type: "host:spotlight", teamId: d.teamId }));
    host(EVC.hostShowcase, hostShowcaseSchema, (d) => this.dispatch({ type: "host:showcase", teamId: d.teamId, voting: d.voting }));
    host(EVC.hostNewRun, empty, () => ({ ok: true, archivedTo: this.newRun() }));
    host(EVC.hostExport, empty, () => ({ ok: true, dir: this.exportResults() }));
    host(EVC.hostModel, hostModelSchema, (d) => ({ ok: this.gateway.setDisabled(d.id, d.disabled) }));
    host(EVC.hostGeminiKey, hostGeminiKeySchema, (d) => {
      saveKey(this.store.dir, d.key);
      this.gateway.provider = this.pickProvider();
      return { ok: true, keySet: this.keySet, provider: this.gateway.provider.name };
    });
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
      case "unlockTile": {
        const t = this.state.teams[d.teamId];
        const v = variantOf(this.state, d.tileId);
        return this.dispatch({
          type: "host:unlockTile",
          teamId: d.teamId,
          tileId: d.tileId,
          reference: referenceFragment(d.tileId, v, t?.name ?? ""),
          result: allPassed(checklist(d.tileId, v).map((i) => i.id), this.now()),
        });
      }
    }
  }

  /* ---------------- Ask, Check ---------------- */

  /** Run the tile's checks and record the result (may complete the tile). */
  async autoCheck(teamId: string, tileId: TileId) {
    const t = this.state.teams[teamId];
    if (!t) return null;
    const result = await this.runner.checkTile(tileId, variantOf(this.state, tileId), t.tiles[tileId].fragment, t.name);
    const res = this.dispatch({ type: "check:result", teamId, tileId, result });
    return { result, completed: res.completed ?? [] };
  }

  async check(studentId: string, tileId: TileId): Promise<CheckAck> {
    const begin = this.dispatch({ type: "check:begin", studentId, tileId });
    if (!begin.ok || !begin.teamId) return { ok: false, error: begin.error };
    const r = await this.autoCheck(begin.teamId, tileId);
    if (!r) return { ok: false, error: E.notNow };
    return { ok: true, check: r.result, done: r.completed.length > 0 };
  }

  /** A student's Ask: queue it to the AI (or Safe Mode), install the answer, check it. */
  async ask(studentId: string, tileId: TileId, text: string): Promise<AskAck> {
    if (this.internet.has(studentId)) return { ok: false, error: E.internetBlocked };
    const begin = this.dispatch({ type: "ask:begin", studentId, tileId });
    if (!begin.ok || !begin.teamId) return { ok: false, error: begin.error };
    const teamId = begin.teamId;
    const t = this.state.teams[teamId];
    const variant = variantOf(this.state, tileId);
    const prompt = buildPrompt({
      tileId,
      variant,
      fragment: t.tiles[tileId].fragment,
      notes: t.notes,
      teamName: t.name,
      ask: text,
      changeRequest: !!t.changeRequest && t.changeRequest.doneAt == null,
    });
    let fragment = null;
    let explanation = "";
    let backup = false;
    let model = "";
    const safe = this.state.settings.safeMode || !this.gateway.shouldTry();
    if (!safe) {
      const r = await this.gateway.complete(teamId, prompt, (txt) => {
        const p = parseAnswer(txt);
        return p.ok ? p : null;
      });
      if (r.ok) {
        fragment = r.value.fragment;
        explanation = r.value.explanation;
        model = r.model;
      }
    }
    if (!fragment && (safe || this.gateway.down())) {
      // Safe Mode: the event goes on with Bulbu's backup answer
      fragment = referenceFragment(tileId, variant, t.name);
      backup = true;
    }
    this.logPrompt({ teamId, studentId, tileId, text, ok: !!fragment, model: backup ? "safe-mode" : model });
    if (!fragment) {
      this.dispatch({ type: "ask:fail", teamId });
      return { ok: false, error: E.aiDown };
    }
    const delivered = this.dispatch({ type: "ask:deliver", teamId, tileId, fragment, queued: this.gateway.queued });
    if (!delivered.ok) return { ok: false, error: delivered.error };
    const r = await this.autoCheck(teamId, tileId);
    return { ok: true, explanation, backup, glitched: !!delivered.glitched, check: r?.result };
  }

  /** Results (JSON + CSV, plus the Ask log if kept) in runs/<runId>/. Private: they contain Student IDs. */
  exportResults(): string {
    const dir = path.join(this.store.dir, "runs", this.state.runId);
    fs.mkdirSync(dir, { recursive: true });
    const results = buildResults(this.state);
    fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(dir, "results.csv"), resultsCsv(results));
    const log = path.join(this.store.dir, "prompts.jsonl");
    if (fs.existsSync(log)) {
      const mine = fs
        .readFileSync(log, "utf8")
        .split("\n")
        .filter((l) => l.includes(`"runId":"${this.state.runId}"`));
      if (mine.length) fs.writeFileSync(path.join(dir, "prompts.jsonl"), mine.join("\n") + "\n");
    }
    this.store.log("export", { dir });
    return dir;
  }

  /** Publish: the site check on the composed page, then live on the sites port. */
  async publish(studentId: string): Promise<PublishAck> {
    const begin = this.dispatch({ type: "publish:begin", studentId });
    if (!begin.ok || !begin.teamId) return { ok: false, error: begin.error };
    const teamId = begin.teamId;
    if (this.publishing.has(teamId)) return { ok: false, error: E.publishBusy };
    this.publishing.add(teamId);
    try {
      const t = this.state.teams[teamId];
      const fragments = Object.fromEntries(TILE_IDS.map((id) => [id, t.tiles[id].fragment])) as Record<ScoredTileId, Fragment>;
      const variants = Object.fromEntries(TILE_IDS.map((id) => [id, variantOf(this.state, id)])) as Record<ScoredTileId, Variant>;
      const cr = t.changeRequest && t.changeRequest.doneAt == null ? TASKS.changeRequests.find((c) => c.id === t.changeRequest!.variant) : undefined;
      const site = await this.runner.checkSite(fragments, variants, t.name, cr?.phrase);
      const problems: NonNullable<PublishAck["problems"]> = [];
      for (const id of TILE_IDS) {
        const r = site.tiles[id];
        if (r.passed === r.total) continue;
        const items = checklist(id, variants[id]).filter((i) => !r.items[i.id]).map((i) => i.text);
        problems.push({ tileId: id, title: tileConfig(id).title, items });
      }
      if (site.pageErrors.length) problems.push({ tileId: "page", title: "Page", items: site.pageErrors.slice(0, 3) });
      if (!site.ok) return { ok: false, problems };
      const slug = t.publish?.slug ?? `${slugify(t.name)}-${t.id}`;
      this.sites.write(slug, compose(fragments, { title: `${t.name} · ${TASKS.event.name}`, csp: true }));
      const res = this.dispatch({ type: "publish:result", teamId, changePassed: site.changePassed === true, slug });
      if (!res.ok) return { ok: false, error: res.error };
      if (cr && site.changePassed !== true) problems.push({ tileId: "change", title: "Change request", items: [cr.text] });
      return { ok: true, sitePath: `/s/${slug}/`, problems };
    } finally {
      this.publishing.delete(teamId);
    }
  }

  private logPrompt(entry: Record<string, unknown>) {
    if (!this.state.settings.logPrompts) return;
    try {
      fs.appendFileSync(path.join(this.store.dir, "prompts.jsonl"), JSON.stringify({ t: this.now(), runId: this.state.runId, ...entry }) + "\n");
    } catch {
      /* ignore */
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
