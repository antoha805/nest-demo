import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { EnvironmentVariables, MailMailer } from '../config/env.validation';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Sends by MAIL_MAILER, like Laravel: through the SMTP server of MAIL_URL,
// through Amazon SES, or to the log. Off without one.
@Injectable()
export class Mailer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Mailer.name);
  private readonly mailer?: MailMailer;
  private readonly from?: string;
  private transport: Transporter | null = null;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.mailer = config.get('MAIL_MAILER', { infer: true });
    this.from = config.get('MAIL_FROM', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    this.transport = await this.createTransport();
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

  private async createTransport(): Promise<Transporter | null> {
    switch (this.mailer) {
      case 'smtp':
        return createTransport(this.config.get('MAIL_URL', { infer: true }));
      case 'ses': {
        // Loaded only for SES, as the SDK takes memory the others do not need.
        const { SESv2Client, SendEmailCommand } =
          await import('@aws-sdk/client-sesv2');
        const region = this.config.get('AWS_REGION', { infer: true });
        return createTransport({
          SES: { sesClient: new SESv2Client({ region }), SendEmailCommand },
        });
      }
      default:
        return null;
    }
  }
}
