// Copies the detailed case-study content from seed/seed-data.json into the LIVE backend (matched by slug).
//
//   Dry run (changes nothing, shows what would change):
//     $env:LIVE_API="https://frush.franticpro.com:8982"; $env:ADMIN_EMAIL="you@…"; $env:ADMIN_PASSWORD="…"
//     node scripts/push-case-studies.mjs
//   Really update the live data:
//     node scripts/push-case-studies.mjs --apply
//   Only one case study:
//     node scripts/push-case-studies.mjs --only trishul-homecare [--apply]
//
// Only the fields listed in FIELDS are overwritten. Nothing is created or deleted.
// Log in with your own admin account — the password is read from the environment and never stored.
import { readFileSync } from "node:fs";

const FIELDS = ["caseStudy", "summary", "industry", "platform", "playStore", "liveUrl", "caseUrl"];
import { createInterface } from "node:readline";

// Defaults to the live backend; asks for the admin login in the terminal if it isn't set in the environment.
const API = (process.env.LIVE_API || "https://frush.franticpro.com:8982").replace(/\/$/, "");
function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
    rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); });
  });
}
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || (await ask("Live admin email: "));
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (await ask("Live admin password (hidden): ", true));
const apply = process.argv.includes("--apply");
const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;

if (!API || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set LIVE_API, ADMIN_EMAIL and ADMIN_PASSWORD first (see the top of this file).");
  process.exit(1);
}

const seed = JSON.parse(readFileSync(new URL("../seed/seed-data.json", import.meta.url), "utf8"));
const local = seed.caseStudies.filter((c) => c.caseStudy && (!only || c.slug === only));
if (!local.length) {
  console.error("No case studies with detailed content found" + (only ? ` for "${only}"` : "") + ".");
  process.exit(1);
}

async function call(path, init = {}, token) {
  const res = await fetch(API + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

const { accessToken } = await call("/auth/login", { method: "POST", body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
const liveList = await call("/admin/caseStudies", {}, accessToken);
const live = Array.isArray(liveList) ? liveList : liveList.items ?? [];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

console.log(apply ? "APPLYING to" : "DRY RUN against", API, "\n");
for (const c of local) {
  const target = live.find((l) => l.slug === c.slug);
  if (!target) { console.log(`- ${c.slug}: not found on live — skipped (create it in the Admin Panel first)`); continue; }
  const patch = {};
  for (const f of FIELDS) if (f in c && !same(c[f], target[f])) patch[f] = c[f];
  const changed = Object.keys(patch);
  if (!changed.length) { console.log(`- ${c.slug}: already identical`); continue; }
  console.log(`- ${c.slug}: will update ${changed.join(", ")}`);
  if (apply) {
    await call(`/admin/caseStudies/${target._id ?? target.id}`, { method: "PATCH", body: JSON.stringify(patch) }, accessToken);
    console.log("    updated ✔");
  }
}
if (!apply) console.log("\nNothing was changed. Add --apply to update the live data.");
