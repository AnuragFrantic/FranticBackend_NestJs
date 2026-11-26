import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { leadRef, type Contact, type Lead } from './lead-emails.js';

const LOGO = join(process.cwd(), 'assets', 'frantic-logo.png'); // dark logo, for the white page
const BRAND = '#2563eb';
const ACCENT = '#06b6d4';
const INK = '#0b1a3a';
const MUTED = '#64748b';
const LINE = '#e6e8ef';
const SOFT = '#f4f7fd';

// The built-in PDF font (Helvetica) has no ₹ or Indian-language glyphs: write ₹ as "Rs."
// and drop anything else it cannot draw, so the PDF never shows broken boxes.
const pdfText = (v: unknown) =>
  String(v ?? '')
    .replace(/₹\s?/g, 'Rs. ')
    .replace(/[^\n\x20-\x7E\xA0-\xFF–—‘’“”•…€]/g, '')
    .trim();

/**
 * One-page "Enquiry Summary" PDF sent to the client (and copied to the sales team):
 * their details, what happens next, why Frantic, and how to reach us.
 */
export function buildLeadPdf(lead: Lead, c: Contact): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: { Title: `Enquiry Summary ${leadRef(lead)}`, Author: 'Frantic Infotech', Subject: pdfText(lead.service) || 'Project enquiry' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (b: Buffer) => chunks.push(b));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const left = 50;
    const width = W - 100;

    /* ---------- header ---------- */
    doc.rect(0, 0, W, 6).fill(BRAND);
    doc.rect(W * 0.6, 0, W * 0.4, 6).fill(ACCENT);
    if (existsSync(LOGO)) doc.image(LOGO, left, 34, { width: 150 });
    else doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text('FRANTIC', left, 38);

    const created = new Date(lead.createdAt ?? Date.now());
    doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text('Enquiry Summary', left, 36, { width, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text(`Ref: ${leadRef(lead)}`, left, 58, { width, align: 'right' })
      .text(created.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), { width, align: 'right' });

    doc.moveTo(left, 98).lineTo(left + width, 98).lineWidth(1).strokeColor(LINE).stroke();

    /* ---------- greeting ---------- */
    doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(`Hi ${pdfText(lead.name)},`, left, 118);
    doc.moveDown(0.4).font('Helvetica').fontSize(10.5).fillColor('#334155').text(
      'Thank you for contacting Frantic Infotech. We have received your enquiry and one of our experts will get back to you within one business day with ideas, a timeline and a free, no-obligation estimate.',
      { width, lineGap: 3 },
    );

    /* ---------- details table ---------- */
    let y = doc.y + 18;
    y = sectionTitle(doc, 'Your enquiry', left, y);
    const rows: [string, string][] = (
      [
        ['Name', lead.name],
        ['Email', lead.email],
        ['Phone', lead.phone],
        ['Company', lead.company],
        ['Service', lead.service],
        ['Budget', lead.budget],
        ['Message', lead.message],
      ] as [string, string | undefined][]
    )
      .map(([k, v]) => [k, pdfText(v)] as [string, string])
      .filter(([, v]) => v);

    const labelW = 110;
    rows.forEach(([label, value], i) => {
      doc.font('Helvetica').fontSize(10);
      const h = Math.max(24, doc.heightOfString(value, { width: width - labelW - 20, lineGap: 2 }) + 12);
      if (i % 2 === 0) doc.rect(left, y, width, h).fill(SOFT);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(label, left + 10, y + 7, { width: labelW });
      doc.font('Helvetica').fontSize(10).fillColor('#334155').text(value, left + labelW + 10, y + 7, { width: width - labelW - 20, lineGap: 2 });
      y += h;
    });

    /* ---------- next steps ---------- */
    y = sectionTitle(doc, 'What happens next', left, y + 22);
    const steps = [
      ['We review your idea', 'A senior consultant studies your requirements and goals.'],
      ['Free consultation call', 'We discuss features, platforms and timelines with you.'],
      ['Proposal & estimate', 'You get a clear scope, timeline and cost, with no obligation.'],
    ];
    const colW = (width - 24) / 3;
    steps.forEach(([title, text], i) => {
      const x = left + i * (colW + 12);
      doc.roundedRect(x, y, colW, 92, 8).fillAndStroke('#ffffff', LINE);
      doc.circle(x + 22, y + 22, 11).fill(BRAND);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(String(i + 1), x + 11, y + 16.5, { width: 22, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(title, x + 12, y + 42, { width: colW - 24 });
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(text, x + 12, y + 57, { width: colW - 24, lineGap: 1 });
    });
    y += 92;

    /* ---------- why us ---------- */
    y = sectionTitle(doc, 'Why businesses choose Frantic', left, y + 24);
    const stats = [
      ['530+', 'Happy clients'],
      ['1000+', 'Projects delivered'],
      ['70+', 'Apps on Play Store'],
      ['Since 2016', 'Building apps & web'],
    ];
    const sW = (width - 36) / 4;
    stats.forEach(([value, label], i) => {
      const x = left + i * (sW + 12);
      doc.roundedRect(x, y, sW, 54, 8).fill(i % 2 ? SOFT : INK);
      doc.font('Helvetica-Bold').fontSize(15).fillColor(i % 2 ? INK : '#ffffff').text(value, x, y + 11, { width: sW, align: 'center' });
      doc.font('Helvetica').fontSize(8.5).fillColor(i % 2 ? MUTED : '#cbd5e1').text(label, x, y + 32, { width: sW, align: 'center' });
    });
    y += 54;

    doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(
      'Mobile app development (Android, iOS, Flutter, React Native) · Website design & development · AI chatbots & agents · Digital marketing & SEO · Cloud & security',
      left, y + 16, { width, align: 'center', lineGap: 2 },
    );

    /* ---------- footer ---------- */
    // the footer sits inside the bottom margin; without this pdfkit would start a new page
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - 96;
    doc.rect(0, fy, W, 96).fill(INK);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('Talk to us', left, fy + 18);
    const contactLine = [pdfText(c.email), ...c.phones.slice(0, 2).map(pdfText)].filter(Boolean).join('   •   ');
    doc.font('Helvetica').fontSize(9.5).fillColor('#cbd5e1').text(contactLine, left, fy + 36, { width });
    doc.fillColor(ACCENT).text(c.website.replace(/^https?:\/\//, ''), left, fy + 54, { link: c.website, underline: false, lineBreak: false });
    doc.rect(0, doc.page.height - 6, W, 6).fill(BRAND);

    doc.end();
  });
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, x: number, y: number) {
  doc.rect(x, y + 2, 3, 12).fill(BRAND);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(title, x + 10, y);
  return y + 24;
}
