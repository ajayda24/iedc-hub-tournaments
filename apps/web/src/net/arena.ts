"use client";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import {
  EV,
  type FeedItem,
  type HelloAck,
  type HostState,
  type LbMessage,
  type MeState,
  type PublicState,
  type Role,
} from "@iedc/shared/protocol";
import { arenaUrl } from "@/lib/arena";
import { deviceToken } from "@/lib/storage";

export type Conn = "idle" | "connecting" | "online" | "offline";

export interface ArenaStore {
  conn: Conn;
  helloDone: boolean;
  helloError: string | null;
  offset: number;
  rtt: number | null;
  state: PublicState | null;
  lb: LbMessage | null;
  me: MeState | null;
  host: HostState | null;
  feed: FeedItem[];
  kicked: string | null;
  bumped: string | null;
}

export const useArena = create<ArenaStore>(() => ({
  conn: "idle",
  helloDone: false,
  helloError: null,
  offset: 0,
  rtt: null,
  state: null,
  lb: null,
  me: null,
  host: null,
  feed: [],
  kicked: null,
  bumped: null,
}));

const set = useArena.setState;
let socket: Socket | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;

export function serverNow() {
  return Date.now() + useArena.getState().offset;
}

export function emitAck<T = any>(event: string, payload?: unknown, timeoutMs = 6000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) return reject(new Error("Not connected to the arena"));
    socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: T) => (err ? reject(err) : resolve(res)));
  });
}

export function emit(event: string, payload?: unknown) {
  socket?.emit(event, payload);
}

async function syncClock(samples: number) {
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < samples; i++) {
    try {
      const t0 = Date.now();
      const s = await emitAck<number>(EV.ping, t0, 2500);
      const t1 = Date.now();
      const rtt = t1 - t0;
      if (!best || rtt < best.rtt) best = { rtt, offset: s - (t0 + rtt / 2) };
    } catch {
      /* skip sample */
    }
  }
  if (best) {
    set({ offset: best.offset, rtt: best.rtt });
    socket?.emit(EV.rtt, best.rtt);
  }
}

export interface ConnectOptions {
  role: Role;
  pin?: string;
}

/** One socket per tab. Calling again with the same role is a no-op. */
export function connectArena(opts: ConnectOptions) {
  if (socket) return socket;
  set({ conn: "connecting" });
  socket = io(arenaUrl(), {
    transports: ["websocket", "polling"],
    reconnectionDelay: 600,
    reconnectionDelayMax: 3000,
    timeout: 8000,
  });

  socket.on("connect", async () => {
    set({ conn: "online" });
    try {
      const hello = await emitAck<HelloAck>(EV.hello, {
        role: opts.role,
        token: opts.role === "player" ? deviceToken() : undefined,
        pin: opts.pin,
      });
      if (!hello.ok) {
        set({ helloError: hello.error ?? "Rejected", helloDone: true });
        if (opts.role === "player" && hello.error) set({ kicked: hello.error });
        return;
      }
      set({ offset: hello.serverNow - Date.now(), helloDone: true, helloError: null, me: hello.me ?? null });
      void syncClock(5);
    } catch {
      set({ helloError: "The arena didn't answer.", helloDone: true });
    }
  });
  socket.on("disconnect", () => set({ conn: "offline" }));
  socket.io.on("reconnect_attempt", () => set({ conn: "connecting" }));
  socket.on(EV.state, (state: PublicState) => set({ state }));
  socket.on(EV.lb, (lb: LbMessage) => set({ lb }));
  socket.on(EV.me, (me: MeState) => set({ me }));
  socket.on(EV.host, (host: HostState) => set({ host }));
  socket.on(EV.feed, (item: FeedItem) =>
    set((s) => (s.feed.some((f) => f.id === item.id) ? s : { feed: [...s.feed, item].slice(-30) })),
  );
  socket.on(EV.kicked, ({ reason }: { reason: string }) => set({ kicked: reason, me: null }));
  socket.on(EV.bumped, ({ reason }: { reason: string }) => {
    set({ bumped: reason });
    socket?.disconnect();
  });

  syncTimer = setInterval(() => socket?.connected && syncClock(3), 30_000);
  return socket;
}

export function disconnectArena() {
  if (syncTimer) clearInterval(syncTimer);
  socket?.disconnect();
  socket = null;
  set({ conn: "idle", helloDone: false });
}

/** Rejoin after a reset/kick: drop the old socket state and connect again. */
export function reconnectArena(opts: ConnectOptions) {
  disconnectArena();
  set({ kicked: null, me: null, bumped: null });
  return connectArena(opts);
}
