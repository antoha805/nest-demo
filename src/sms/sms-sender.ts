import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables, SmsDriver } from '../config/env.validation';
import { Sms, SmsTransport } from './sms-transport';
import { SnsTransport } from './transports/sns.transport';
import { TwilioTransport } from './transports/twilio.transport';

// Sends texts by SMS_DRIVER, like Mailer does mails: through Amazon SNS,
// through Twilio, or to the log. Off without one.
@Injectable()
export class SmsSender implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmsSender.name);
  private readonly driver?: SmsDriver;
  private transport: SmsTransport | null = null;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.driver = config.get('SMS_DRIVER', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    this.transport = await this.createTransport();
    if (!this.enabled) {
      this.logger.log('SMS is off, as SMS_DRIVER is not set');
    }
  }

  get enabled(): boolean {
    return this.driver !== undefined;
  }

  async send(sms: Sms): Promise<void> {
    if (this.transport) {
      await this.transport.send(sms);
    } else if (this.driver === 'log') {
      this.logger.log({ sms }, 'Logged an SMS, as SMS_DRIVER is log');
    } else {
      throw new Error('SMS is off, as SMS_DRIVER is not set');
    }
  }

  onModuleDestroy(): void {
    this.transport?.close?.();
  }

  private async createTransport(): Promise<SmsTransport | null> {
    const get = <K extends keyof EnvironmentVariables>(key: K) =>
      this.config.get(key, { infer: true });
    switch (this.driver) {
      case 'sns':
        return SnsTransport.create(get('AWS_REGION')!, get('SMS_FROM'));
      case 'twilio':
        return TwilioTransport.create(
          get('TWILIO_ACCOUNT_SID')!,
          get('TWILIO_AUTH_TOKEN')!,
          get('SMS_FROM')!,
        );
      default:
        return null;
    }
  }
}
