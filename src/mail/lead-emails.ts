// Email templates for website leads (based on the old landing-page lead helpers).
import type { LeadSource } from '../public/lead-source.js';

export type Lead = {
  _id?: unknown;
  formKey?: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  service?: string;
  budget?: string;
  message?: string;
  source?: Partial<LeadSource>;
  createdAt?: Date | string;
};

export type Contact = { email: string; phones: string[]; whatsapp?: string; website: string };

const BRAND = '#2563eb';
const INK = '#0b1a3a';

export const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Short reference shown to the client and the sales team, e.g. FI-20261116-3F9A2C */
export const leadRef = (lead: Lead) => {
  const d = new Date(lead.createdAt ?? Date.now());
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `FI-${ymd}-${String(lead._id ?? Date.now().toString(16)).slice(-6).toUpperCase()}`;
};

/** "/mobile-app-development-services/" from a full URL (or the value as it is) */
const pathOf = (page?: string) => {
  try {
    return page ? new URL(page).pathname : '';
  } catch {
    return page ?? '';
  }
};

/** e.g. "New Lead: Mobile App Development | ₹3–10 lakh | /mobile-app-development-services/ | Google Ads" */
export const leadSubject = (prefix: string, lead: Lead) =>
  [`${prefix}: ${lead.service || lead.name}`, lead.budget, pathOf(lead.source?.page), lead.source?.channel].filter(Boolean).join(' | ');

const table = (rows: [string, unknown][]) =>
  rows
    .filter(([, v]) => v)
    .map(
      ([label, value], i) => `
        <tr${i % 2 ? ' style="background-color:#f4f7fd;"' : ''}>
          <td style="padding:10px 12px;font-weight:bold;width:140px;vertical-align:top;color:${INK};">${label}</td>
          <td style="padding:10px 12px;color:#334155;">${escapeHtml(value).replace(/\n/g, '<br>')}</td>
        </tr>`,
    )
    .join('');

const shell = (title: string, inner: string, footer: string) => `
<div style="font-family:Arial,Helvetica,sans-serif;background-color:#f5f7fb;padding:30px 12px;">
  <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:12px;box-shadow:0 2px 10px rgba(11,26,58,0.06);overflow:hidden;">
    <div style="background:linear-gradient(135deg,${BRAND},#06b6d4);background-color:${BRAND};padding:22px 24px;color:#ffffff;">
      <h2 style="margin:0;font-size:20px;">${escapeHtml(title)}</h2>
    </div>
    <div style="padding:24px;">${inner}</div>
    <div style="padding:16px 24px;background:#f5f7fb;font-size:12px;color:#64748b;">${footer}</div>
  </div>
</div>`;

/** Email to the sales team: every field, plus where the lead came from. */
export function teamEmail(lead: Lead) {
  const src = lead.source ?? {};
  const details: [string, unknown][] = [
    ['Name', lead.name],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Company', lead.company],
    ['Service', lead.service],
    ['Budget', lead.budget],
    ['Message', lead.message],
    ['Reference', leadRef(lead)],
  ];
  const mins = Number(src.timeOnPageSec);
  const origin: [string, unknown][] = [
    ['Channel', src.channel],
    ['Form', [src.placement, lead.formKey && `(${lead.formKey})`].filter(Boolean).join(' ')],
    ['Page', src.pageUrl || src.page],
    ['Page title', src.pageTitle],
    ['Referrer', src.referrer],
    ['Landing page (this visit)', src.landingPage !== src.pageUrl ? src.landingPage : ''],
    ['First visit', [src.firstLandingPage, src.firstReferrer && `from ${src.firstReferrer}`, src.firstVisitAt && `on ${new Date(src.firstVisitAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`].filter(Boolean).join(' ')],
    ['UTM source', src.utmSource],
    ['UTM medium', src.utmMedium],
    ['UTM campaign', src.utmCampaign],
    ['UTM term (keyword)', src.utmTerm],
    ['UTM content', src.utmContent],
    ['Google Ads click (gclid)', src.gclid || src.gbraid || src.wbraid],
    ['Facebook click (fbclid)', src.fbclid],
    ['Microsoft Ads click (msclkid)', src.msclkid],
    ['Headline keyword (?kw=)', src.kw],
    ['Time on page', Number.isFinite(mins) && src.timeOnPageSec ? (mins >= 60 ? `${Math.floor(mins / 60)} min ${mins % 60} s` : `${mins} s`) : ''],
    ['Pages viewed this visit', src.pagesThisVisit],
  ];
  const visitor: [string, unknown][] = [
    ['IPv4', src.ipv4],
    ['IPv6', src.ipv6],
    ['IP seen by server', src.ip && src.ip !== src.ipv4 && src.ip !== src.ipv6 ? src.ip : ''],
    ['X-Forwarded-For', src.forwardedFor],
    ['Device', src.device],
    ['Screen / window', [src.screen, src.viewport].filter(Boolean).join(' / ')],
    ['Language', src.language],
    ['Time zone', src.timezone],
    ['Browser (user agent)', src.userAgent],
  ];
  const h = (t: string) => `<h3 style="margin:26px 0 8px;font-size:15px;color:${INK};border-left:3px solid ${BRAND};padding-left:8px;">${t}</h3>`;
  return shell(
    `🚀 New lead from the website`,
    `<table style="width:100%;border-collapse:collapse;font-size:14px;">${table(details)}</table>
     <p style="margin:20px 0 0;">
       <a href="mailto:${escapeHtml(lead.email)}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:bold;">Reply to ${escapeHtml(lead.name)}</a>
       &nbsp;
       <a href="tel:${escapeHtml(lead.phone)}" style="display:inline-block;border:1px solid #cbd5e1;color:${INK};text-decoration:none;padding:9px 18px;border-radius:999px;font-weight:bold;">Call ${escapeHtml(lead.phone)}</a>
     </p>
     ${h('Where this lead came from')}
     <table style="width:100%;border-collapse:collapse;font-size:13px;">${table(origin)}</table>
     ${h('Visitor details')}
     <table style="width:100%;border-collapse:collapse;font-size:13px;">${table(visitor)}</table>`,
    'This message was generated from your website contact form. The enquiry summary PDF sent to the client is attached.',
  );
}

/** Thank-you email to the person who filled in the form, with the PDF summary attached. */
export function clientEmail(lead: Lead, c: Contact) {
  const first = lead.name.split(' ')[0] || lead.name;
  const rows: [string, unknown][] = [
    ['Service', lead.service],
    ['Budget', lead.budget],
    ['Your message', lead.message],
    ['Reference', leadRef(lead)],
  ];
  const phone = c.phones[0];
  return shell(
    'Thank you for contacting Frantic Infotech',
    `<p style="margin:0 0 14px;font-size:15px;color:${INK};">Hi ${escapeHtml(first)},</p>
     <p style="margin:0 0 14px;font-size:15px;color:#334155;line-height:1.6;">
       Thanks for reaching out! We’ve received your enquiry and one of our experts will get back to you
       <b>within one business day</b> with ideas, a timeline and a free estimate.
     </p>
     <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 18px;">${table(rows)}</table>
     <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.6;">
       We’ve attached a short PDF summary of your enquiry and what happens next. Need to talk sooner?
     </p>
     <p style="margin:0;">
       ${phone ? `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ''))}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:bold;">Call ${escapeHtml(phone)}</a>&nbsp;` : ''}
       ${c.whatsapp ? `<a href="${escapeHtml(c.whatsapp)}" style="display:inline-block;border:1px solid #cbd5e1;color:${INK};text-decoration:none;padding:9px 18px;border-radius:999px;font-weight:bold;">Chat on WhatsApp</a>` : ''}
     </p>
     <p style="margin:24px 0 0;font-size:14px;color:#334155;">Warm regards,<br><b>Team Frantic Infotech</b></p>`,
    `Frantic Infotech · <a href="${escapeHtml(c.website)}" style="color:${BRAND};">${escapeHtml(c.website.replace(/^https?:\/\//, ''))}</a> · ${escapeHtml(c.email)}<br>
     You received this email because you submitted an enquiry on our website.`,
  );
}
