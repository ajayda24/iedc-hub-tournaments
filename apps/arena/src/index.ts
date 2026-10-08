import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import type { NetIface, NetworkInfo } from "@iedc/shared";
import { Arena } from "./arena";
import { createRealtime } from "./realtime";
import { listInterfaces } from "./net/interfaces";
import { hasInternet } from "./net/internetCheck";
import { Store } from "./persist/store";
import { site } from "@iedc/data/site";

const VERSION = "0.1.0";

const { values: args } = parseArgs({
  options: {
    port: { type: "string", default: process.env.ARENA_PORT ?? String(site.defaultPort) },
    data: { type: "string", default: process.env.ARENA_DATA ?? "arena-data" },
    web: { type: "string", default: process.env.ARENA_WEB },
    pin: { type: "string", default: process.env.ARENA_PIN },
    fresh: { type: "boolean", default: false },
    dev: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const port = Number(args.port);
const pin = args.pin ?? String(1000 + Math.floor(Math.random() * 9000));
const here = path.dirname(fileURLToPath(import.meta.url));

/** The static web build: next to the bundle (packed) or in the monorepo (dev). */
function findWebDir(): string | null {
  const candidates = [args.web, path.join(here, "web"), path.join(here, "..", "web"), path.join(here, "..", "..", "web", "out")];
  for (const c of candidates) if (c && fs.existsSync(path.join(c, "index.html"))) return path.resolve(c);
  return null;
}

async function main() {
  const store = new Store(path.resolve(args.data!));
  const app = Fastify({ logger: false, trustProxy: false });

  let interfaces: NetIface[] = [];
  let internet: boolean | null = null;
  const network = (): NetworkInfo => ({ port, interfaces, internet, groups: [] });

  const rt = createRealtime(app.server, { pin, onExport: () => store.exportCsv(arena) });
  const arena = new Arena({ out: { ...rt.output, log: (t, d) => store.log(t, d) }, network });
  rt.attach(arena);

  const snap = args.fresh ? null : store.load();
  if (snap) arena.restore(snap);
  store.watch(arena);

  const webDir = findWebDir();
  if (webDir) {
    await app.register(fastifyStatic, {
      root: webDir,
      prefix: "/",
      redirect: true,
      preCompressed: true,
      cacheControl: false,
      setHeaders(res, filePath) {
        const immutable = filePath.includes(`${path.sep}_next${path.sep}static${path.sep}`);
        res.header("Cache-Control", immutable ? "public, max-age=31536000, immutable" : "no-cache");
      },
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/") || req.url.startsWith("/socket.io")) return reply.code(404).send({ ok: false });
      const nf = path.join(webDir, "404.html");
      if (fs.existsSync(nf)) return reply.code(404).type("text/html").send(fs.createReadStream(nf));
      return reply.code(404).send("Not found");
    });
  } else {
    app.get("/", async (_req, reply) =>
      reply
        .type("text/html")
        .send(
          `<h1>Brain Arena is running</h1><p>No web build found. Run <code>pnpm build</code> (or use <code>pnpm dev</code> and open port 3000).</p>`,
        ),
    );
  }

  app.get("/api/health", async () => ({ ok: true, app: "brain-arena", version: VERSION, now: Date.now() }));

  const refreshNetwork = async () => {
    try {
      const next = await listInterfaces(port);
      const changed = next.map((i) => i.url).join() !== interfaces.map((i) => i.url).join();
      interfaces = next;
      if (changed) arena.setConfig(arena.config); // re-broadcast join urls
    } catch {
      /* ignore */
    }
  };
  const refreshInternet = async () => {
    const before = internet;
    internet = await hasInternet();
    if (before !== internet) {
      arena.setConfig(arena.config);
      if (internet) console.log("\n  ⚠  This laptop can reach the internet. Turn off mobile data on the hotspot so students can't either.\n");
    }
  };
  await refreshNetwork();
  setInterval(refreshNetwork, 10_000).unref();
  void refreshInternet();
  setInterval(refreshInternet, 20_000).unref();

  await app.listen({ port, host: "0.0.0.0" });
  banner(webDir);

  const shutdown = () => {
    console.log("\n  Saving and shutting down…");
    store.close(arena);
    arena.dispose();
    rt.io.close();
    void app.close().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  function banner(web: string | null) {
    const line = "─".repeat(58);
    console.log(`\n  ${line}`);
    console.log(`   ${site.appName.toUpperCase()} v${VERSION}  ·  ${site.organiser}`);
    console.log(`  ${line}`);
    console.log(`   Host PIN      ${pin}`);
    console.log(`   Host console  http://localhost:${port}/host/`);
    console.log(`   Big screen    http://localhost:${port}/screen/`);
    if (interfaces.length === 0) console.log(`   Students      (no network yet — turn on the hotspot)`);
    for (const i of interfaces) console.log(`   Students      ${i.url.padEnd(34)} ${i.label}`);
    if (!web) console.log(`\n   (no web build found — dev mode: web app on http://localhost:3000)`);
    if (snap) console.log(`\n   Restored previous event: ${arena.players.size} players, ${arena.roundsPlayed} rounds played. Use --fresh to start clean.`);
    console.log(`  ${line}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
