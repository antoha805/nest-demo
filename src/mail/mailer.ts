import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { EnvironmentVariables } from '../config/env.validation';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Sends through the SMTP server of MAIL_URL. Without one, such as in
// development, it logs the mail instead, like Laravel's log mailer.
@Injectable()
export class Mailer implements OnModuleDestroy {
  private readonly logger = new Logger(Mailer.name);
  private readonly transport: Transporter | null;
  private readonly from?: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const url = config.get('MAIL_URL', { infer: true });
    this.transport = url ? createTransport(url) : null;
    this.from = config.get('MAIL_FROM', { infer: true });
  }

  async send(mail: Mail): Promise<void> {
    if (!this.transport) {
      this.logger.log(
        { mail: { to: mail.to, subject: mail.subject, text: mail.text } },
        'Logged a mail, as MAIL_URL is not set',
      );
      return;
    }
    await this.transport.sendMail({ from: this.from, ...mail });
  }

  onModuleDestroy(): void {
    this.transport?.close();
  }
}
