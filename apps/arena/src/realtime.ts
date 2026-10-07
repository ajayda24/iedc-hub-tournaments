import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  EV,
  adjustSchema,
  cheatSchema,
  eventConfigSchema,
  helloSchema,
  idSchema,
  joinSchema,
  resetSchema,
  startSchema,
  submitSchema,
  type HelloAck,
  type Role,
} from "@iedc/shared";
import type { Arena, ArenaOutput } from "./arena";

interface SocketData {
  role?: Role;
  playerId?: string;
  lastCheatAt?: number;
}

type Ack = (res: unknown) => void;
const safeAck = (ack: unknown): Ack => (typeof ack === "function" ? (ack as Ack) : () => {});

export interface RealtimeOptions {
  pin: string;
  onExport?: () => string;
}

/** Socket.IO transport. Builds the ArenaOutput the Arena talks to. */
export function createRealtime(http: HttpServer, opts: RealtimeOptions) {
  const io = new Server<any, any, any, SocketData>(http, {
    cors: { origin: "*" },
    pingInterval: 10_000,
    pingTimeout: 8_000,
    maxHttpBufferSize: 64 * 1024,
    perMessageDeflate: false,
  });

  let arena!: Arena;
  const socketsByPlayer = new Map<string, string>();

  const output: Omit<ArenaOutput, "log"> = {
    state: (s) => io.emit(EV.state, s),
    me: (id, me) => {
      const sid = socketsByPlayer.get(id);
      if (sid) io.to(sid).emit(EV.me, me);
    },
    lb: (msg) => io.emit(EV.lb, msg),
    feed: (item) => io.emit(EV.feed, item),
    host: (h) => io.to("hosts").emit(EV.host, h),
    kicked: (id, reason) => {
      const sid = socketsByPlayer.get(id);
      if (!sid) return;
      io.to(sid).emit(EV.kicked, { reason });
      socketsByPlayer.delete(id);
      const s = io.sockets.sockets.get(sid);
      if (s) s.data.playerId = undefined;
    },
  };

  const bindPlayer = (socket: Socket, playerId: string, previousSocket: string | null | undefined) => {
    if (previousSocket && previousSocket !== socket.id) {
      const old = io.sockets.sockets.get(previousSocket);
      if (old) {
        old.emit(EV.bumped, { reason: "You opened the game somewhere else. This tab is now asleep." });
        old.data.playerId = undefined;
        old.disconnect(true);
      }
    }
    socket.data.playerId = playerId;
    socketsByPlayer.set(playerId, socket.id);
  };

  const sendSnapshot = (socket: Socket) => {
    socket.emit(EV.state, arena.publicState());
    socket.emit(EV.lb, arena.lbMessage());
    for (const f of arena.recentFeed()) socket.emit(EV.feed, f);
  };

  function attach(a: Arena) {
    arena = a;
    io.on("connection", (socket: Socket) => {
      const ip = (socket.handshake.address || "").replace(/^::ffff:/, "");
      const isHost = () => socket.data.role === "host";
      const pid = () => socket.data.playerId as string | undefined;

      socket.on(EV.hello, (raw: unknown, ack: unknown) => {
        const reply = safeAck(ack);
        const parsed = helloSchema.safeParse(raw);
        if (!parsed.success) return reply({ ok: false, error: "Bad hello", serverNow: Date.now() } satisfies HelloAck);
        const { role, token, pin } = parsed.data;
        if (role === "host") {
          if (pin !== opts.pin) return reply({ ok: false, error: "Wrong PIN", serverNow: Date.now() } satisfies HelloAck);
          socket.data.role = "host";
          socket.join("hosts");
          sendSnapshot(socket);
          socket.emit(EV.host, arena.hostState());
          return reply({ ok: true, serverNow: Date.now() } satisfies HelloAck);
        }
        socket.data.role = role;
        socket.join(role === "screen" ? "screens" : "players");
        sendSnapshot(socket);
        if (role === "player" && token) {
          const { player, previousSocket } = arena.attach(token, socket.id, ip);
          if (player?.kicked) return reply({ ok: false, error: "The host removed you from this event.", serverNow: Date.now() });
          if (player) {
            bindPlayer(socket, player.id, previousSocket);
            return reply({ ok: true, serverNow: Date.now(), me: arena.meState(player) } satisfies HelloAck);
          }
        }
        reply({ ok: true, serverNow: Date.now(), me: null } satisfies HelloAck);
      });

      socket.on(EV.ping, (_t: unknown, ack: unknown) => safeAck(ack)(Date.now()));

      socket.on(EV.rtt, (rtt: unknown) => {
        const id = pid();
        if (id && typeof rtt === "number" && rtt >= 0 && rtt < 60_000) arena.setRtt(id, rtt);
      });

      socket.on(EV.join, (raw: unknown, ack: unknown) => {
        const reply = safeAck(ack);
        const parsed = joinSchema.safeParse(raw);
        if (!parsed.success) return reply({ ok: false, error: "Fill in your name, semester and department." });
        const res = arena.join(parsed.data, socket.id, ip);
        if (res.ok && res.me) bindPlayer(socket, res.me.id, res.previousSocket);
        reply({ ok: res.ok, error: res.error, me: res.me });
      });

      socket.on(EV.submit, (raw: unknown, ack: unknown) => {
        const reply = safeAck(ack);
        const id = pid();
        const parsed = submitSchema.safeParse(raw);
        if (!id || !parsed.success) return reply({ ok: false, error: "Join first." });
        reply(arena.submit(id, parsed.data.roundId, parsed.data.sub));
      });

      socket.on(EV.cheat, (raw: unknown, ack: unknown) => {
        const reply = safeAck(ack);
        const id = pid();
        const parsed = cheatSchema.safeParse(raw);
        if (!id || !parsed.success) return reply({ action: "noted" });
        // one report per second is plenty
        const now = Date.now();
        if (socket.data.lastCheatAt && now - socket.data.lastCheatAt < 1000 && parsed.data.kind === "focus") {
          return reply({ action: "noted" });
        }
        socket.data.lastCheatAt = now;
        reply(arena.cheat(id, parsed.data));
      });

      socket.on(EV.cheatClear, () => {
        const id = pid();
        if (id) arena.clearInternet(id);
      });

      /* ---------- host controls ---------- */
      const hostOnly = (event: string, handler: (raw: unknown) => unknown) => {
        socket.on(event, (raw: unknown, ack: unknown) => {
          const reply = safeAck(ack);
          if (!isHost()) return reply({ ok: false, error: "Host only." });
          try {
            reply(handler(raw) ?? { ok: true });
          } catch (e) {
            reply({ ok: false, error: e instanceof Error ? e.message : "Failed" });
          }
        });
      };

      hostOnly(EV.hostConfig, (raw) => {
        const parsed = eventConfigSchema.safeParse(raw);
        if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid config" };
        arena.setConfig(parsed.data);
        return { ok: true };
      });
      hostOnly(EV.hostStart, (raw) => {
        const parsed = startSchema.safeParse(raw ?? undefined);
        return arena.startRound(parsed.success ? parsed.data?.index : undefined);
      });
      hostOnly(EV.hostEnd, () => arena.endRound());
      hostOnly(EV.hostPause, () => arena.pause());
      hostOnly(EV.hostResume, () => arena.resume());
      hostOnly(EV.hostPodium, () => arena.showPodium());
      hostOnly(EV.hostLobby, () => arena.toLobby());
      hostOnly(EV.hostKick, (raw) => {
        const p = idSchema.safeParse(raw);
        return p.success ? arena.kick(p.data.id) : { ok: false };
      });
      hostOnly(EV.hostUnblock, (raw) => {
        const p = idSchema.safeParse(raw);
        return p.success ? arena.unblock(p.data.id) : { ok: false };
      });
      hostOnly(EV.hostAdjust, (raw) => {
        const p = adjustSchema.safeParse(raw);
        return p.success ? arena.adjust(p.data.id, p.data.delta) : { ok: false };
      });
      hostOnly(EV.hostReset, (raw) => {
        const p = resetSchema.safeParse(raw);
        return arena.reset(p.success ? p.data.keepPlayers : true);
      });
      hostOnly(EV.hostExport, () => ({ ok: true, csv: arena.toCsv(), savedTo: opts.onExport?.() }));

      socket.on("disconnect", () => {
        const id = pid();
        if (id && socketsByPlayer.get(id) === socket.id) {
          socketsByPlayer.delete(id);
          arena.disconnect(socket.id);
        }
      });
    });
  }

  return { io, output, attach };
}
