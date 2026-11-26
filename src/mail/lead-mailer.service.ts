import { Injectable, Logger } from '@nestjs/common';
import { ContentService } from '../content/content.service.js';
import { MailService } from './mail.service.js';
import { buildLeadPdf } from './lead-pdf.js';
import { clientEmail, leadRef, leadSubject, teamEmail, type Contact, type Lead } from './lead-emails.js';

/**
 * What happens by email when someone fills in a website form:
 *   1. the sales team gets the lead (LEADS_NOTIFY_TO), with Reply-To set to the client
 *   2. the client gets a thank-you email with an "Enquiry Summary" PDF (LEAD_AUTO_REPLY=false turns this off)
 */
@Injectable()
export class LeadMailer {
  private readonly log = new Logger('LeadMailer');

  constructor(
    private readonly mail: MailService,
    private readonly content: ContentService,
  ) {}

  async leadReceived(lead: Lead) {
    try {
      const contact = await this.contact();
      const pdf = await buildLeadPdf(lead, contact);
      const attachment = { filename: `Frantic-Infotech-Enquiry-${leadRef(lead)}.pdf`, content: pdf, contentType: 'application/pdf' };

      const team = (process.env.LEADS_NOTIFY_TO || process.env.SMTP_USER || contact.email)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await Promise.all([
        this.mail.send({ to: team, subject: leadSubject('New Lead', lead), html: teamEmail(lead), replyTo: lead.email, attachments: [attachment] }),
        process.env.LEAD_AUTO_REPLY === 'false'
          ? Promise.resolve(true)
          : this.mail.send({
              to: lead.email,
              subject: `We’ve received your enquiry – Frantic Infotech (${leadRef(lead)})`,
              html: clientEmail(lead, contact),
              replyTo: contact.email,
            }),
      ]);
    } catch (err) {
      this.log.error(`Lead emails failed: ${(err as Error).message}`);
    }
  }

  /** Contact details from Admin → Settings */
  private async contact(): Promise<Contact> {
    const site = ((await this.content.getSetting('site')) ?? {}) as Partial<{ email: string; phones: string[]; whatsapp: string }>;
    return {
      email: site.email || 'sales@franticpro.com',
      phones: site.phones?.length ? site.phones : ['+91 88879 98502'],
      whatsapp: site.whatsapp,
      website: process.env.SITE_URL || 'https://www.franticpro.com',
    };
  }
}
