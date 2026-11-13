import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { SmsSender } from '../../sms/sms-sender';
import { User } from '../../users/user.entity';
import { SmsRecipient } from '../notification';
import {
  NotificationChannel,
  NotificationDelivery,
  sendEach,
} from './notification-channel';

// Texts each user at their phone number. Users without one are skipped, so
// notifications can list sms for everyone. Sent one by one, so one failure
// does not stop the others.
@Injectable()
export class SmsChannel implements NotificationChannel {
  constructor(
    private readonly em: EntityManager,
    private readonly sender: SmsSender,
  ) {}

  // Off without SMS_DRIVER.
  get enabled(): boolean {
    return this.sender.enabled;
  }

  async send(deliveries: NotificationDelivery[]): Promise<void> {
    const recipients = await this.findRecipients(
      deliveries.map(({ userId }) => userId),
    );
    await sendEach(
      deliveries,
      async ({ userId, notification }) => {
        // Without a phone number, or deleted since the notification was sent.
        const recipient = recipients.get(userId);
        if (!recipient) {
          return;
        }
        const text = notification.toSms(recipient).render();
        await this.sender.send({ to: recipient.phone, text });
      },
      'SMS',
    );
  }

  private async findRecipients(
    userIds: string[],
  ): Promise<Map<string, SmsRecipient>> {
    // Forked, so the partly loaded users stay out of the request's identity map.
    const users = await this.em
      .fork()
      .find(
        User,
        { id: { $in: userIds }, phone: { $ne: null } },
        { fields: ['id', 'phone', 'nickname'] },
      );
    return new Map(
      users.map(({ id, phone, nickname }) => [
        id,
        { id, phone: phone!, nickname },
      ]),
    );
  }
}
