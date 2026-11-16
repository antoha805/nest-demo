import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { Mailer } from '../../mail/mailer';
import {
  NotificationChannel,
  NotificationDelivery,
  sendEach,
} from './notification-channel';

// Mails each notifiable at its mail route, such as a user's email. Sent one by
// one, so one failure does not stop the others.
@Injectable()
export class MailChannel implements NotificationChannel {
  private readonly appUrl: string;

  constructor(
    private readonly mailer: Mailer,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true });
  }

  async send(deliveries: NotificationDelivery[]): Promise<void> {
    await sendEach(
      deliveries,
      async ({ notifiable, notification }) => {
        const to = notifiable.routeNotificationFor('mail');
        if (!to) {
          return;
        }
        const mail = notification.toMail(notifiable).render(this.appUrl);
        await this.mailer.send({ to, ...mail });
      },
      'mail(s)',
    );
  }
}
