import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentService } from '../content/content.service.js';

type Doc = Record<string, unknown>;
type HomeStat = { value: number; suffix: string; label: string };
type Rules = {
  replace: [string, string][];
  stats: { value: string; label: string }[];
  homeStats?: HomeStat[];
  forbidden: string[];
};

/**
 * Ongoing content fix, runs on every start-up: every service/company page, every FAQ and the homepage's
 * own About text and stats use the same company facts — since 2016, 1000+ projects, 530+ clients,
 * 350+ custom software for enterprises, 7+ timezones served.
 * Old phrases ("366+ projects", "400+ clients", "9+ years", "75+", "10+ awards"…) are replaced word for word,
 * using the rules in seed/company-facts.json. It only touches documents that still contain an old phrase,
 * so it does nothing once everything is up to date, and it saves a backup to seed/backups/ first.
 */
export async function fixCompanyFacts(content: ContentService) {
  const file = join(process.cwd(), 'seed', 'company-facts.json');
  if (!existsSync(file)) return;
  const rules = JSON.parse(readFileSync(file, 'utf8')) as Rules;

  const hasForbidden = (v: unknown) => {
    const text = JSON.stringify(v);
    return rules.forbidden.some((f) => text.includes(f));
  };

  const pages = (await content.list('servicePages')) as Doc[];
  const outdatedPages = pages.filter((p) => hasForbidden({ ...p, stats: undefined }));

  const faqs = (await content.list('faqs')) as Doc[];
  const outdatedFaqs = faqs.filter((f) => hasForbidden(f));

  const home = await content.getSetting('home');
  const homeStats = (home.stats as HomeStat[] | undefined) ?? [];
  const homeOutdated = hasForbidden({ ...home, stats: undefined }) || homeStats.some((s) => /year/i.test(s.label) && s.value < 10);

  if (!outdatedPages.length && !outdatedFaqs.length && !homeOutdated) return;

  const dir = join(process.cwd(), 'seed', 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(dir, `company-facts-${stamp}.json`), JSON.stringify({ servicePages: outdatedPages, faqs: outdatedFaqs, home }, null, 2));

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

  for (const p of outdatedPages) {
    const { _id, createdAt, updatedAt, ...rest } = p;
    void createdAt; void updatedAt;
    const fixed = fix(rest) as Doc;
    if (Array.isArray(p.stats) && p.stats.length) fixed.stats = rules.stats;
    await content.update('servicePages', String(_id), fixed);
  }

  for (const f of outdatedFaqs) {
    const { _id, createdAt, updatedAt, ...rest } = f;
    void createdAt; void updatedAt;
    await content.update('faqs', String(_id), fix(rest) as Doc);
  }

  if (homeOutdated) {
    const { stats: _homeStats, ...restHome } = home;
    void _homeStats;
    const fixedHome = fix(restHome) as Doc;
    fixedHome.stats = rules.homeStats?.length ? rules.homeStats : homeStats.map((s) => (/year/i.test(s.label) && s.value < 10 ? { ...s, value: 10 } : s));
    await content.saveSetting('home', fixedHome);
  }

  console.log(
    `Company facts fixed: ${outdatedPages.length} page(s), ${outdatedFaqs.length} FAQ(s), ${phrases} phrase(s) replaced${homeOutdated ? ', homepage text & stats updated' : ''}. Backup: seed/backups/company-facts-${stamp}.json`,
  );
}
