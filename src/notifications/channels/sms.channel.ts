import { Injectable } from '@nestjs/common';
import { SmsSender } from '../../sms/sms-sender';
import {
  NotificationChannel,
  NotificationDelivery,
  sendEach,
} from './notification-channel';

// Texts each notifiable at its SMS route, such as a user's phone. Those without
// one are skipped, so notifications can list sms for every user. Sent one by
// one, so one failure does not stop the others.
@Injectable()
export class SmsChannel implements NotificationChannel {
  constructor(private readonly sender: SmsSender) {}

  async send(deliveries: NotificationDelivery[]): Promise<void> {
    await sendEach(
      deliveries,
      async ({ notifiable, notification }) => {
        const to = notifiable.routeNotificationFor('sms');
        if (!to) {
          return;
        }
        const text = notification.toSms(notifiable).render();
        await this.sender.send({ to, text });
      },
      'SMS',
    );
  }
}
