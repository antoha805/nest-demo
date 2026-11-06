import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { EnvironmentVariables, MailMailer } from '../config/env.validation';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Sends by MAIL_MAILER, like Laravel: through the SMTP server of MAIL_URL, or
// to the log. Off without one.
@Injectable()
export class Mailer implements OnModuleDestroy {
  private readonly logger = new Logger(Mailer.name);
  private readonly mailer?: MailMailer;
  private readonly transport: Transporter | null;
  private readonly from?: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.mailer = config.get('MAIL_MAILER', { infer: true });
    const url = config.get('MAIL_URL', { infer: true });
    this.transport =
      this.mailer === 'smtp' && url ? createTransport(url) : null;
    this.from = config.get('MAIL_FROM', { infer: true });
    if (!this.enabled) {
      this.logger.log('Mail is off, as MAIL_MAILER is not set');
    }
  }

  get enabled(): boolean {
    return this.mailer !== undefined;
  }

  async send(mail: Mail): Promise<void> {
    if (this.transport) {
      await this.transport.sendMail({ from: this.from, ...mail });
    } else if (this.mailer === 'log') {
      this.logger.log(
        { mail: { to: mail.to, subject: mail.subject, text: mail.text } },
        'Logged a mail, as MAIL_MAILER is log',
      );
    } else {
      throw new Error('Mail is off, as MAIL_MAILER is not set');
    }
  }

  onModuleDestroy(): void {
    this.transport?.close();
  }
}
