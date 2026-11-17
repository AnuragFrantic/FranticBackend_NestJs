// Turns the visitor context sent by the website (and what the server sees) into a clean
// "where did this lead come from" record, saved on the lead and shown in the lead email.

export type LeadSource = {
  page: string; // path of the page with the form, e.g. /mobile-app-development-services/
  utm: string; // raw query string (kept for older reports)
  channel: string; // e.g. "Google Ads", "Organic search (google.com)", "Direct"
  placement?: string; // which form on the page
  pageUrl?: string;
  pageTitle?: string;
  referrer?: string;
  landingPage?: string;
  firstLandingPage?: string;
  firstReferrer?: string;
  firstVisitAt?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  msclkid?: string;
  kw?: string;
  ip?: string; // address the server saw
  ipv4?: string;
  ipv6?: string;
  forwardedFor?: string;
  userAgent?: string;
  device?: string; // e.g. "Mobile · Android · Chrome"
  language?: string;
  timezone?: string;
  screen?: string;
  viewport?: string;
  timeOnPageSec?: string;
  pagesThisVisit?: string;
};

// Only these keys are accepted from the browser, each trimmed to a sane length.
const ALLOWED: Record<string, number> = {
  placement: 80, pageUrl: 500, pageTitle: 200, referrer: 500, landingPage: 500, firstLandingPage: 500, firstReferrer: 500,
  firstVisitAt: 40, utmSource: 120, utmMedium: 120, utmCampaign: 200, utmTerm: 200, utmContent: 200, gclid: 200,
  gbraid: 200, wbraid: 200, fbclid: 300, msclkid: 200, kw: 120, ipv4: 15, ipv6: 45, language: 40, timezone: 60,
  screen: 20, viewport: 20, timeOnPageSec: 8, pagesThisVisit: 6,
};
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

const hostOf = (url?: string) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
};

/** Very small user-agent reader — enough for "Mobile · Android · Chrome". */
export function describeDevice(ua = ''): string {
  if (!ua) return '';
  const type = /iPad|Tablet/i.test(ua) ? 'Tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'Mobile' : 'Desktop';
  const os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iOS/i.test(ua) ? 'iOS' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [type, os, browser].filter(Boolean).join(' · ');
}

/** Marketing channel, in the order Google Analytics would use. */
function channelOf(s: Partial<LeadSource>): string {
  if (s.gclid || s.gbraid || s.wbraid) return 'Google Ads';
  if (s.msclkid) return 'Microsoft (Bing) Ads';
  const medium = (s.utmMedium ?? '').toLowerCase();
  const source = s.utmSource ?? '';
  if (/^(cpc|ppc|paid|paidsearch|paid_social|paidsocial|display|cpm)$/.test(medium)) return `Paid – ${source || medium}`;
  if (s.fbclid) return 'Facebook / Instagram';
  if (source) return medium ? `${source} / ${medium}` : source;
  const ref = hostOf(s.referrer) || hostOf(s.firstReferrer);
  if (!ref) return 'Direct';
  if (/google\.|bing\.|yahoo\.|duckduckgo\.|yandex\.|baidu\./.test(ref)) return `Organic search (${ref})`;
  if (/facebook\.|instagram\.|linkedin\.|lnkd\.in|t\.co$|twitter\.|x\.com|youtube\.|pinterest\.|reddit\./.test(ref)) return `Social (${ref})`;
  if (/chatgpt\.|openai\.|perplexity\.|claude\.ai|gemini\.google|copilot\./.test(ref)) return `AI assistant (${ref})`;
  return `Referral (${ref})`;
}

export function buildLeadSource(
  body: Record<string, unknown>,
  server: { ip?: string; userAgent?: string; forwardedFor?: string },
): LeadSource {
  const raw = (body.context && typeof body.context === 'object' ? body.context : {}) as Record<string, unknown>;
  const ctx: Record<string, string> = {};
  for (const [k, max] of Object.entries(ALLOWED)) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim()) ctx[k] = v.trim().slice(0, max);
  }
  if (ctx.ipv4 && !IPV4.test(ctx.ipv4)) delete ctx.ipv4;
  if (ctx.ipv6 && !(IPV6.test(ctx.ipv6) && ctx.ipv6.includes(':'))) delete ctx.ipv6;

  const ip = (server.ip ?? '').replace(/^::ffff:/, '');
  const forwardedFor = (server.forwardedFor ?? '').slice(0, 200);
  const firstForwarded = forwardedFor.split(',')[0]?.trim() ?? '';
  const clientIp = firstForwarded || ip; // behind a proxy (Vercel, Nginx) the real visitor is the first X-Forwarded-For entry
  // if the browser couldn't look up its IPs, fill in what the server saw
  if (!ctx.ipv4 && IPV4.test(clientIp)) ctx.ipv4 = clientIp;
  if (!ctx.ipv6 && clientIp.includes(':') && clientIp !== '::1') ctx.ipv6 = clientIp;

  const page = String(body.page ?? '').trim().slice(0, 300) || (hostOf(ctx.pageUrl) ? new URL(ctx.pageUrl).pathname : '');
  const userAgent = (server.userAgent ?? '').slice(0, 400);
  const source: LeadSource = {
    page,
    utm: String(body.utm ?? '').trim().slice(0, 300),
    channel: '',
    ...ctx,
    ip,
    ...(forwardedFor ? { forwardedFor } : {}),
    userAgent,
    device: describeDevice(userAgent),
  };
  source.channel = channelOf(source);
  return source;
}
