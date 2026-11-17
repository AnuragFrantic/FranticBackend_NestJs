import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Attachment = { filename: string; content: Buffer; contentType?: string };
export type Mail = { to: string | string[]; subject: string; html: string; replyTo?: string; attachments?: Attachment[] };

/** Where test mails go when SMTP isn't configured (development only). */
export const OUTBOX_DIR = join(process.cwd(), 'mail-outbox');

/**
 * Sends email with nodemailer.
 *
 * SMTP settings come from .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS …).
 * If SMTP_USER / SMTP_PASS are empty, nothing leaves the machine: in development every
 * mail is saved as an .eml file (plus its attachments) in Backend/mail-outbox instead.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private readonly transporter: Transporter;
  private readonly toOutbox: boolean;
  readonly from: string;

  constructor() {
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    this.from = process.env.MAIL_FROM?.trim() || (user ? `Frantic Infotech <${user}>` : 'Frantic Infotech <sales@franticpro.com>');
    this.toOutbox = !user || !pass;

    if (this.toOutbox) {
      // builds the full message but writes it to a file instead of sending it
      this.transporter = createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
      const where = process.env.NODE_ENV === 'production' ? 'nowhere (production)' : 'Backend/mail-outbox';
      this.log.warn(`SMTP_USER / SMTP_PASS not set — emails are not sent, they are saved to ${where}`);
    } else {
      const port = Number(process.env.SMTP_PORT || 587);
      this.transporter = createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465, // 587 = STARTTLS
        auth: { user, pass },
      });
    }
  }

  /** Send one email. Never throws — a mail problem must not break the lead form. */
  async send(mail: Mail): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({ from: this.from, ...mail });
      if (this.toOutbox) this.saveToOutbox(mail, info.message as Buffer);
      else this.log.log(`Sent "${mail.subject}" to ${[mail.to].flat().join(', ')} (${info.messageId})`);
      return true;
    } catch (err) {
      this.log.error(`Could not send "${mail.subject}" to ${[mail.to].flat().join(', ')}: ${(err as Error).message}`);
      return false;
    }
  }

  private saveToOutbox(mail: Mail, message: Buffer) {
    if (process.env.NODE_ENV === 'production') return;
    mkdirSync(OUTBOX_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const to = [mail.to].flat()[0].replace(/[^\w.@-]/g, '_');
    writeFileSync(join(OUTBOX_DIR, `${stamp}_${to}.eml`), message);
    for (const a of mail.attachments ?? []) writeFileSync(join(OUTBOX_DIR, `${stamp}_${a.filename}`), a.content);
    this.log.log(`Saved "${mail.subject}" for ${[mail.to].flat().join(', ')} to mail-outbox (open the .eml in any mail app)`);
  }
}
