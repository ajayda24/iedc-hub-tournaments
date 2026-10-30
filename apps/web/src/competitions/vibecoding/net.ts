"use client";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import {
  COMPETITIONS_NAMESPACE,
  EVC,
  type CHelloAck,
  type CompetitionRole,
  type HostView,
  type PersonView,
  type TeamView,
  type WallView,
} from "@iedc/shared/competitions/vibecoding/protocol";
import { arenaUrl } from "@/lib/arenaUrl";
import { deviceToken } from "@/lib/storage";

export type Conn = "idle" | "connecting" | "online" | "offline";

export interface VcStore {
  conn: Conn;
  helloDone: boolean;
  helloError: string | null;
  offset: number;
  wall: WallView | null;
  me: PersonView | null;
  team: TeamView | null;
  host: HostView | null;
  toast: { text: string; at: number } | null;
  bumped: string | null;
}

export const useVc = create<VcStore>(() => ({
  conn: "idle",
  helloDone: false,
  helloError: null,
  offset: 0,
  wall: null,
  me: null,
  team: null,
  host: null,
  toast: null,
  bumped: null,
}));

const set = useVc.setState;
let socket: Socket | null = null;

/** Server-synced now. */
export const vcNow = () => Date.now() + useVc.getState().offset;

export function vcAck<T = { ok: boolean; error?: string }>(event: string, payload?: unknown, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) return reject(new Error("Not connected to the arena"));
    socket.timeout(timeoutMs).emit(event, payload ?? {}, (err: Error | null, res: T) => (err ? reject(err) : resolve(res)));
  });
}

export function vcEmit(event: string, payload?: unknown) {
  socket?.emit(event, payload ?? {});
}

export function showToast(text: string) {
  set({ toast: { text, at: Date.now() } });
}

/** Ack an action and toast its error, if any. */
export async function vcAct<T extends { ok: boolean; error?: string }>(event: string, payload?: unknown, timeoutMs?: number): Promise<T | null> {
  try {
    const res = await vcAck<T>(event, payload, timeoutMs);
    if (!res.ok && res.error) showToast(res.error);
    return res;
  } catch (e) {
    showToast(e instanceof Error ? e.message : "Something went wrong");
    return null;
  }
}

async function syncClock() {
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < 4; i++) {
    try {
      const t0 = Date.now();
      const s = await vcAck<number>(EVC.ping, t0, 2500);
      const rtt = Date.now() - t0;
      if (!best || rtt < best.rtt) best = { rtt, offset: s - (t0 + rtt / 2) };
    } catch {
      /* skip */
    }
  }
  if (best) set({ offset: best.offset });
}

/** One socket per tab, on the /competitions namespace. */
export function connectVc(opts: { competition: string; role: CompetitionRole; pin?: string }) {
  if (socket) return socket;
  set({ conn: "connecting" });
  socket = io(`${arenaUrl()}${COMPETITIONS_NAMESPACE}`, {
    transports: ["websocket", "polling"],
    reconnectionDelay: 600,
    reconnectionDelayMax: 3000,
    timeout: 8000,
  });
  socket.on("connect", async () => {
    set({ conn: "online" });
    try {
      const hello = await vcAck<CHelloAck>(EVC.hello, {
        competition: opts.competition,
        role: opts.role,
        token: opts.role === "player" ? deviceToken() : undefined,
        pin: opts.pin,
      });
      if (!hello.ok) return set({ helloError: hello.error ?? "Rejected", helloDone: true });
      set({ offset: hello.serverNow - Date.now(), helloDone: true, helloError: null, me: hello.me ?? null });
      void syncClock();
    } catch {
      set({ helloError: "The arena didn't answer.", helloDone: true });
    }
  });
  socket.on("disconnect", () => set({ conn: "offline" }));
  socket.io.on("reconnect_attempt", () => set({ conn: "connecting" }));
  socket.on(EVC.wall, (wall: WallView) => set({ wall }));
  socket.on(EVC.me, (me: PersonView | null) => set({ me }));
  socket.on(EVC.team, (team: TeamView | null) => set({ team }));
  socket.on(EVC.host, (host: HostView) => set({ host }));
  socket.on(EVC.toast, ({ text }: { text: string }) => showToast(text));
  socket.on(EVC.bumped, ({ reason }: { reason: string }) => {
    set({ bumped: reason });
    socket?.disconnect();
  });
  setInterval(() => socket?.connected && void syncClock(), 30_000);
  return socket;
}

export function reconnectVc(opts: { competition: string; role: CompetitionRole; pin?: string }) {
  socket?.disconnect();
  socket = null;
  set({ conn: "idle", helloDone: false, helloError: null, bumped: null });
  return connectVc(opts);
}
