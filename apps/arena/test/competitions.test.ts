import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { EVC, type TeamView, type WallView } from "@iedc/shared/competitions/vibecoding/protocol";
import { createCompetitions } from "../src/competitions";
import { Students } from "../src/students";
import type { RoomDeps } from "../src/competitions/vibecoding/room";

/** A real arena-like server: http + Socket.IO + the competitions namespace, in a temp data folder. */
export async function startServer(dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-")), room: Partial<RoomDeps> = {}) {
  const server = http.createServer();
  const io = new Server(server);
  const students = new Students(dataDir);
  const comps = createCompetitions(io, { pin: "2468", students, dataDir, room: { ai: "mock", mock: { latencyMs: [5, 20], failRate: 0, badRate: 0, quality: 1 }, checkWorkers: 1, ...room } });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/competitions`;
  const clients: Socket[] = [];
  const client = async (role: "player" | "host" | "screen", extra: Record<string, unknown> = {}) => {
    const s = connect(url, { transports: ["websocket"], forceNew: true });
    clients.push(s);
    await new Promise<void>((r) => s.on("connect", () => r()));
    const hello = await s.timeout(3000).emitWithAck("hello", { competition: "vibecoding", role, ...extra });
    return { s, hello };
  };
  const close = async () => {
    for (const c of clients) c.disconnect();
    comps.close();
    io.close();
    await new Promise((r) => server.close(r));
  };
  return { url, io, comps, dataDir, client, close, room: comps.rooms.vibecoding };
}

export const joinPayload = (studentId: string, name = studentId) => ({
  token: `tok-${studentId}-xxxxxxxx`,
  studentId,
  pin: "1234",
  name,
  sem: "S3",
  dept: "CSE",
  avatar: 3,
});

export function next<T>(s: Socket, event: string, pred: (v: T) => boolean = () => true, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    const on = (v: T) => {
      if (!pred(v)) return;
      clearTimeout(t);
      s.off(event, on);
      resolve(v);
    };
    s.on(event, on);
  });
}

let srv: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => {
  await srv?.close();
  srv = null;
});

describe("competitions namespace", () => {
  it("rejects unknown competitions and wrong host PINs", async () => {
    srv = await startServer();
    const { s } = await srv.client("screen");
    expect((await srv.client("host", { pin: "0000" })).hello.ok).toBe(false);
    const bad = connect(srv.url, { transports: ["websocket"], forceNew: true });
    await new Promise<void>((r) => bad.on("connect", () => r()));
    const ack = await bad.timeout(3000).emitWithAck("hello", { competition: "nope", role: "screen" });
    expect(ack.ok).toBe(false);
    bad.disconnect();
    expect(s.connected).toBe(true);
  });

  it("host opens registration; players join with Student ID + PIN and form a team", async () => {
    srv = await startServer();
    const host = await srv.client("host", { pin: "2468" });
    expect(host.hello.ok).toBe(true);
    expect((await host.s.emitWithAck(EVC.hostPhase, { phase: "registration" })).ok).toBe(true);

    const a = await srv.client("player", { token: "tok-A1-xxxxxxxx" });
    expect(a.hello.me).toBeNull();
    const joined = await a.s.emitWithAck(EVC.join, joinPayload("A1", "Asha"));
    expect(joined.ok).toBe(true);
    const teamSeen = next<TeamView>(a.s, EVC.team, (t) => t?.name === "Byte Me");
    const created = await a.s.emitWithAck(EVC.teamCreate, { name: "Byte Me" });
    expect(created.ok).toBe(true);
    const view = await teamSeen;
    expect(view.code).toMatch(/^[A-Z2-9]{4}$/);
    expect(view.tiles[0].id).toBe("warmup");
    expect(view.tiles).toHaveLength(9);

    const b = await srv.client("player", { token: "tok-B1-xxxxxxxx" });
    await b.s.emitWithAck(EVC.join, joinPayload("B1", "Binu"));
    expect((await b.s.emitWithAck(EVC.teamJoin, { code: view.code.toLowerCase() })).ok).toBe(true);
    const wall = await next<WallView>(host.s, EVC.wall, (w) => w.teams[0]?.size === 2);
    expect(wall.teams[0].members).toEqual(["Asha", "Binu"]);

    // a wrong PIN for an existing Student ID is refused
    const c = await srv.client("player", { token: "tok-C1-xxxxxxxx" });
    expect((await c.s.emitWithAck(EVC.join, { ...joinPayload("A1"), pin: "9999" })).ok).toBe(false);
  });

  it("a phone reconnects by device token, and a second phone takes over with the PIN", async () => {
    srv = await startServer();
    const host = await srv.client("host", { pin: "2468" });
    await host.s.emitWithAck(EVC.hostPhase, { phase: "registration" });
    const a = await srv.client("player", { token: "tok-A1-xxxxxxxx" });
    await a.s.emitWithAck(EVC.join, joinPayload("A1"));
    a.s.disconnect();
    const again = await srv.client("player", { token: "tok-A1-xxxxxxxx" });
    expect(again.hello.me?.studentId).toBe("A1");

    const other = await srv.client("player", { token: "tok-A1-phone2xx" });
    const bumped = next(again.s, EVC.bumped);
    expect((await other.s.emitWithAck(EVC.join, { ...joinPayload("A1"), token: "tok-A1-phone2xx" })).ok).toBe(true);
    await bumped;
  });

  it("everything survives a restart", async () => {
    srv = await startServer();
    const dataDir = srv.dataDir;
    const host = await srv.client("host", { pin: "2468" });
    await host.s.emitWithAck(EVC.hostPhase, { phase: "registration" });
    const a = await srv.client("player", { token: "tok-A1-xxxxxxxx" });
    await a.s.emitWithAck(EVC.join, joinPayload("A1"));
    await a.s.emitWithAck(EVC.teamCreate, { name: "Persist" });
    await srv.close();

    srv = await startServer(dataDir);
    expect(srv.room.wasRestored).toBe(true);
    expect(srv.room.state.phase).toBe("registration");
    expect(Object.values(srv.room.state.teams).map((t) => t.name)).toEqual(["Persist"]);
    const back = await srv.client("player", { token: "tok-A1-xxxxxxxx" });
    expect(back.hello.me?.teamId).toBe(Object.keys(srv.room.state.teams)[0]);
  });
});
