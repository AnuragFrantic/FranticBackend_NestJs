import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentService } from '../content/content.service.js';

type Doc = Record<string, unknown>;
type Rules = { replace: [string, string][]; stats: { value: string; label: string }[]; forbidden: string[] };

/**
 * One-time content fix (Nov 2026): every service/company page now uses the same company facts as the
 * homepage — since 2016, 366+ projects, 400+ clients, 45+ specialists, 10+ countries.
 * Old phrases ("1000+ projects for 500+ clients", "9+ years", "75+", "10+ awards"…) are replaced word for word,
 * using the rules in seed/company-facts.json. It only runs while an old phrase is still in the database,
 * so it does nothing on later start-ups, and it saves a backup of the pages to seed/backups/ first.
 */
export async function fixCompanyFacts(content: ContentService) {
  const file = join(process.cwd(), 'seed', 'company-facts.json');
  if (!existsSync(file)) return;
  const rules = JSON.parse(readFileSync(file, 'utf8')) as Rules;

  const pages = (await content.list('servicePages')) as Doc[];
  const textOf = (p: Doc) => JSON.stringify({ ...p, stats: undefined });
  const outdated = pages.filter((p) => rules.forbidden.some((f) => textOf(p).includes(f)));
  const home = await content.getSetting('home');
  const homeStats = (home.stats as { value: number; suffix: string; label: string }[] | undefined) ?? [];
  const homeOutdated = homeStats.some((s) => /year/i.test(s.label) && s.value < 10);
  if (!outdated.length && !homeOutdated) return;

  const dir = join(process.cwd(), 'seed', 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(dir, `company-facts-${stamp}.json`), JSON.stringify({ servicePages: outdated, home }, null, 2));

  let phrases = 0;
  const fix = (v: unknown): unknown => {
    if (typeof v === 'string') {
      let s = v;
      for (const [from, to] of rules.replace) {
        if (s.includes(from)) { phrases += s.split(from).length - 1; s = s.split(from).join(to); }
      }
      return s;
    }
    if (Array.isArray(v)) return v.map(fix);
    if (v && typeof v === 'object' && !(v instanceof Date) && v.constructor === Object) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === '_id' ? x : fix(x)]));
    }
    return v;
  };

  for (const p of outdated) {
    const { _id, createdAt, updatedAt, ...rest } = p;
    void createdAt; void updatedAt;
    const fixed = fix(rest) as Doc;
    if (Array.isArray(p.stats) && p.stats.length) fixed.stats = rules.stats;
    await content.update('servicePages', String(_id), fixed);
  }
  if (homeOutdated) {
    await content.saveSetting('home', { ...home, stats: homeStats.map((s) => (/year/i.test(s.label) && s.value < 10 ? { ...s, value: 10 } : s)) });
  }
  console.log(
    `Company facts fixed: ${outdated.length} page(s), ${phrases} phrase(s) replaced${homeOutdated ? ', homepage years set to 10' : ''}. Backup: seed/backups/company-facts-${stamp}.json`,
  );
}
