import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { PAGE_CSP, escapeHtml } from "@iedc/shared/competitions/vibecoding/composer";

export interface SiteListing {
  slug: string;
  team: string;
  members: string[];
}

/**
 * Published sites live on their own port (4001), never on the arena's origin:
 * student code can't reach the arena's cookies, storage or sockets. Every page
 * gets a CSP header that blocks network access.
 *   /s/<slug>/       a team's site       (?download=1 saves index.html)
 *   /sites/          the gallery of every published site
 */
export class SitesServer {
  private app: FastifyInstance | null = null;
  port = 0;

  constructor(
    readonly dir: string,
    private list: () => SiteListing[],
    private title: () => string,
  ) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fileFor(slug: string) {
    return path.join(this.dir, slug, "index.html");
  }

  write(slug: string, html: string) {
    fs.mkdirSync(path.join(this.dir, slug), { recursive: true });
    const file = this.fileFor(slug);
    fs.writeFileSync(`${file}.tmp`, html);
    fs.renameSync(`${file}.tmp`, file);
  }

  async listen(port: number, host = "0.0.0.0") {
    const app = Fastify({ logger: false });
    const secure = { "Content-Security-Policy": `${PAGE_CSP}; base-uri 'none'; form-action 'none'`, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

    app.get("/", async (_req, reply) => reply.redirect("/sites/"));
    app.get("/sites", async (_req, reply) => reply.redirect("/sites/"));
    app.get("/sites/", async (_req, reply) => reply.headers({ ...secure, "Content-Type": "text/html; charset=utf-8" }).send(this.gallery()));
    app.get<{ Params: { slug: string } }>("/s/:slug", async (req, reply) => reply.redirect(`/s/${encodeURIComponent(req.params.slug)}/`));
    const serve = async (slug: string, download: boolean, reply: import("fastify").FastifyReply) => {
      if (!/^[a-z0-9-]{1,40}$/.test(slug)) return reply.code(404).send("Not found");
      const file = this.fileFor(slug);
      if (!fs.existsSync(file)) return reply.code(404).type("text/html").send("<h1>Not published (yet)</h1>");
      reply.headers({ ...secure, "Content-Type": "text/html; charset=utf-8" });
      if (download) reply.header("Content-Disposition", `attachment; filename="${slug}.html"`);
      return reply.send(fs.createReadStream(file));
    };
    app.get<{ Params: { slug: string }; Querystring: { download?: string } }>("/s/:slug/", (req, reply) => serve(req.params.slug, req.query.download === "1", reply));
    app.get<{ Params: { slug: string }; Querystring: { download?: string } }>("/s/:slug/index.html", (req, reply) => serve(req.params.slug, req.query.download === "1", reply));
    await app.listen({ port, host });
    const addr = app.server.address();
    this.port = typeof addr === "object" && addr ? addr.port : port;
    this.app = app;
    return this.port;
  }

  private gallery(): string {
    const items = this.list()
      .map((s) => `<li><a href="/s/${escapeHtml(s.slug)}/"><b>${escapeHtml(s.team)}</b><span>${escapeHtml(s.members.join(", "))}</span></a></li>`)
      .join("\n");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(this.title())} · sites</title>
<style>body{font-family:system-ui,sans-serif;background:#fffdf7;color:#1d1b16;margin:0;padding:24px}h1{margin:0 0 16px}
ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
a{display:block;padding:16px;border:2px solid #1d1b16;border-radius:14px;background:#fff;color:inherit;text-decoration:none;box-shadow:3px 3px 0 #1d1b16}
a:hover{transform:translate(-1px,-1px)}b{display:block;font-size:1.2rem}span{font-size:.85rem;opacity:.7}</style></head>
<body><h1>🚀 ${escapeHtml(this.title())}: published sites</h1><ul>
${items || "<li>No sites yet.</li>"}
</ul></body></html>`;
  }

  async close() {
    await this.app?.close();
    this.app = null;
  }
}
