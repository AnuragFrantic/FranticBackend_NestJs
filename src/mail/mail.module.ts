import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { LeadMailer } from './lead-mailer.service.js';
import { ContentModule } from '../content/content.module.js';

/** Email sending (nodemailer). Global, so any module can inject MailService / LeadMailer. */
@Global()
@Module({
  imports: [ContentModule], // LeadMailer reads contact details from Settings
  providers: [MailService, LeadMailer],
  exports: [MailService, LeadMailer],
})
export class MailModule {}
