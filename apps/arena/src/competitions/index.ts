import path from "node:path";
import type { Server } from "socket.io";
import { vcErrors as E } from "@iedc/config/copy/vibecoding";
import { COMPETITIONS_NAMESPACE } from "@iedc/shared/competitions/vibecoding/protocol";
import { cHelloSchema } from "@iedc/shared/competitions/vibecoding/schemas";
import type { Students } from "../students";
import { VibecodingRoom, type RoomDeps } from "./vibecoding/room";

export interface CompetitionsOptions {
  pin: string;
  students: Students;
  /** the arena's data folder; competitions live in <data>/competitions/<id>/ */
  dataDir: string;
  network?: RoomDeps["network"];
  now?: () => number;
}

/**
 * Mounts every competition on the /competitions Socket.IO namespace. A socket
 * says hello with { competition, role } and is handed to that competition's room.
 */
export function createCompetitions(io: Server, opts: CompetitionsOptions) {
  const vibecoding = new VibecodingRoom({
    pin: opts.pin,
    students: opts.students,
    dir: path.join(opts.dataDir, "competitions", "vibecoding"),
    network: opts.network,
    now: opts.now,
  });
  const rooms = { vibecoding } as const;
  const nsp = io.of(COMPETITIONS_NAMESPACE);
  vibecoding.attach(nsp);
  vibecoding.start();

  nsp.on("connection", (socket) => {
    socket.on("hello", (raw: unknown, ack: unknown) => {
      const reply = typeof ack === "function" ? (ack as (r: unknown) => void) : () => {};
      // one successful hello per socket (a wrong host PIN may retry)
      if (socket.data.role) return reply({ ok: false, error: E.notNow, serverNow: Date.now() });
      const p = cHelloSchema.safeParse(raw);
      const room = p.success ? rooms[p.data.competition as keyof typeof rooms] : undefined;
      if (!p.success || !room) return reply({ ok: false, error: E.unknownCompetition, serverNow: Date.now() });
      if (!socket.data.competition) socket.on("disconnect", () => room.onDisconnect(socket));
      socket.data.competition = p.data.competition;
      room.onHello(socket, p.data, reply);
    });
  });

  return {
    rooms,
    close() {
      vibecoding.stop();
    },
  };
}
