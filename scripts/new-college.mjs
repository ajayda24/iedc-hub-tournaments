// First-time setup for a new college. Asks a few questions, creates
// colleges/<id>/college.ts and makes it the active college (.env).
//
//   pnpm new-college
//   pnpm new-college --name "IEDC MEC" --series "Weekly Series" --departments "CSE,ECE" --semesters "S1,S2" --yes
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { values: flags } = parseArgs({
  options: {
    name: { type: "string" },
    series: { type: "string" },
    departments: { type: "string" },
    semesters: { type: "string" },
    id: { type: "string" },
    yes: { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});

const ok = (s) => console.log(`  ✓ ${s}`);
const bad = (s) => console.log(`  ✖ ${s}`);

console.log("\n  Welcome! Let's set this up for your college.\n");

// 1. tools
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 11)) {
  bad(`Node.js ${process.versions.node} is too old. Install Node.js 20 LTS or newer from https://nodejs.org, then run pnpm new-college again.`);
  process.exit(1);
}
ok(`Node.js ${process.versions.node}`);

// 2. questions
const rl = flags.yes ? null : readline.createInterface({ input: process.stdin });
// one line iterator, so answers typed (or pasted) ahead of a question aren't lost
const lines = rl?.[Symbol.asyncIterator]();
async function ask(label, def, flag) {
  if (flag !== undefined) return flag.trim();
  if (!lines) return def;
  process.stdout.write(`  ${label}${def ? ` [${def}]` : ""}: `);
  const { value, done } = await lines.next();
  if (done) process.stdout.write("\n");
  return (done ? "" : value).trim() || def;
}
const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

console.log("\n  Press Enter to keep the suggestion in [brackets].\n");
const org = await ask("Your college or club name (shown as \"by ...\")", "Example College", flags.name);
const series = await ask("Name of your tournament series", "Brain Arena", flags.series);
const depts = list(await ask("Departments, separated by commas", "CSE, ECE, EEE, ME, CE, IT", flags.departments));
const sems = list(await ask("Semesters or years, separated by commas", "S1, S2, S3, S4, S5, S6, S7, S8", flags.semesters));
const slug = org.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "my-college";
const id = (await ask("Short id for your college's folder (lowercase, no spaces)", slug, flags.id)).toLowerCase().replace(/[^a-z0-9-]/g, "");
rl?.close();

if (!depts.length || !sems.length) {
  bad("You need at least one department and one semester.");
  process.exit(1);
}

// 3. write the profile
const dir = path.join(root, "colleges", id);
const file = path.join(dir, "college.ts");
if (fs.existsSync(file) && !flags.force) {
  console.log(`\n  colleges/${id}/ already exists — keeping it as it is and switching to it.`);
  console.log(`  (Edit colleges/${id}/college.ts by hand, or run pnpm new-college --force to overwrite it.)`);
} else {
  const words = series.split(/\s+/);
  const brand = words.length > 1 ? { left: words[0], right: words.slice(1).join(" ") } : { left: series, right: "Arena" };
  const q = JSON.stringify;
  const profile = {
    id,
    appName: series === org ? series : `${org} ${series}`,
    shortName: series,
    brand,
    organiser: `by ${org}`,
    titleTemplate: `%s · ${series}`,
    defaultTitle: `${series} · ${org}`,
    description: `Live logic-game tournaments for ${org} events. Works fully offline on the event Wi-Fi.`,
    manifestDescription: `Live logic-game tournaments for ${org} events.`,
    defaultEventName: series,
  };
  const body = `import type { College } from "../../config/college-types";

/** ${org}. Made by \`pnpm new-college\`; edit freely — every field is explained in config/college-types.ts. */
export const college: College = {
${Object.entries(profile)
  .map(([k, v]) => `  ${k}: ${typeof v === "object" ? `{ left: ${q(v.left)}, right: ${q(v.right)} }` : q(v)},`)
  .join("\n")}
  departments: ${q(depts).replace(/,/g, ", ")},
  semesters: ${q(sems).replace(/,/g, ", ")},
};
`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, body);
  if (!fs.existsSync(path.join(dir, "monthly.json"))) fs.copyFileSync(path.join(root, "colleges", "example", "monthly.json"), path.join(dir, "monthly.json"));
  console.log("");
  ok(`Created colleges/${id}/college.ts`);
}

// 4. make it active
const envFile = path.join(root, ".env");
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
fs.writeFileSync(envFile, /^\s*COLLEGE\s*=.*$/m.test(env) ? env.replace(/^\s*COLLEGE\s*=.*$/m, `COLLEGE=${id}`) : `${env}${env && !env.endsWith("\n") ? "\n" : ""}COLLEGE=${id}\n`);
ok(`Active college is now "${id}" (saved in .env)`);
execSync("node scripts/use-college.mjs --quiet", { cwd: root, stdio: "inherit", env: { ...process.env, COLLEGE: id } });

console.log(`
  Next steps
  ──────────
  pnpm dev          try it on this computer: http://localhost:3000
  pnpm kit          build the event kit for your laptop: dist/event-kit-${id}/
  pnpm check-setup  check that everything is in place

  Publishing the website on Vercel? Add the environment variable COLLEGE = ${id}.
  More help: docs/GETTING_STARTED.md
`);
