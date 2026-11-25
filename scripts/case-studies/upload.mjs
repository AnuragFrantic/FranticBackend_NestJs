#!/usr/bin/env node
/**
 * Uploads the Monte Carlo, Taste Food and CICO case studies (case-studies.json + ./images) to a backend.
 *
 *   node scripts/case-studies/upload.mjs                      -> live API (https://frush.franticpro.com:8982)
 *   node scripts/case-studies/upload.mjs http://localhost:4000
 *   node scripts/case-studies/upload.mjs --dry-run            -> only shows what would be sent
 *
 * Asks for the admin email + password (or reads ADMIN_EMAIL / ADMIN_PASSWORD).
 * Existing case study fields that are not in case-studies.json are kept.
 * Images that are missing from ./images are skipped, so you can add them later and simply run it again.
 * Already uploaded images are remembered in ./uploaded.json and not uploaded twice.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const HERE = dirname(fileURLToPath(import.meta.url));
const IMAGES = join(HERE, 'images');
const CACHE = join(HERE, 'uploaded.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const API = (args.find((a) => /^https?:\/\//.test(a)) ?? 'https://frush.franticpro.com:8982').replace(/\/$/, '');

const data = JSON.parse(readFileSync(join(HERE, 'case-studies.json'), 'utf8'));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const cacheKey = (file) => `${API}|${file}`;

function ask(question, hidden = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : '');
  return new Promise((res) => rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); res(a.trim()); }));
}

let token = '';
async function api(path, init = {}) {
  const r = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${r.status} ${body.message ?? ''}`);
  return body;
}

async function upload(file) {
  if (cache[cacheKey(file)]) return cache[cacheKey(file)];
  if (dryRun) return `/uploads/<${file}>`;
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(join(IMAGES, file))], { type: 'image/webp' }), file);
  const doc = await api('/admin/media/upload', { method: 'POST', body: fd });
  cache[cacheKey(file)] = doc.url;
  writeFileSync(CACHE, JSON.stringify(cache, null, 2));
  console.log(`  uploaded ${file} -> ${doc.url}`);
  return doc.url;
}

const MISSING = Symbol('missing');
/** Replaces "@file.webp" with the uploaded URL; a missing file becomes MISSING and is dropped. */
async function resolve(v) {
  if (typeof v === 'string' && v.startsWith('@')) {
    const file = v.slice(1);
    return existsSync(join(IMAGES, file)) ? upload(file) : MISSING;
  }
  if (Array.isArray(v)) {
    const out = [];
    for (const x of v) {
      const r = await resolve(x);
      if (r !== MISSING) out.push(r);
    }
    return out;
  }
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      const r = await resolve(x);
      if (r === MISSING) {
        if (k === 'image' && 'caption' in v) return MISSING; // a screen row without its image is dropped
        continue;
      }
      if (r === '') continue; // empty captions etc.
      out[k] = r;
    }
    return out;
  }
  return v;
}

async function main() {
  console.log(`Backend: ${API}${dryRun ? '  (dry run — nothing is changed)' : ''}`);
  if (!dryRun) {
    const email = process.env.ADMIN_EMAIL || (await ask('Admin email: '));
    const password = process.env.ADMIN_PASSWORD || (await ask('Admin password: ', true));
    token = (await api('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).accessToken;
  }
  const all = dryRun ? [] : await api('/admin/caseStudies');

  for (const p of data.projects) {
    console.log(`\n${p.slug}`);
    const current = all.find((x) => x.slug === p.slug);
    if (!dryRun && !current) { console.log('  not found on this backend — skipped'); continue; }

    const { slug, ...patch } = await resolve(p);
    const cs = patch.caseStudy ?? {};
    // keep screen groups only when at least one row image is there
    if (cs.screens) cs.screens = cs.screens.filter((g) => g.items?.length);
    if (!cs.screens?.length) delete cs.screens;
    const missing = JSON.stringify(p).match(/@[\w.-]+/g).filter((f) => !existsSync(join(IMAGES, f.slice(1))));
    if (missing.length) console.log(`  images not in ./images yet (skipped): ${missing.map((f) => f.slice(1)).join(', ')}`);

    const body = { ...patch, caseStudy: { ...(current?.caseStudy ?? {}), ...cs } };
    if (dryRun) { console.log(JSON.stringify(body, null, 2).slice(0, 1500)); continue; }
    await api(`/admin/caseStudies/${current._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    console.log('  saved ✓');
  }
  console.log('\nDone. The website picks the changes up within ~30 seconds.');
}

main().catch((e) => { console.error('\nError:', e.message); process.exit(1); });
