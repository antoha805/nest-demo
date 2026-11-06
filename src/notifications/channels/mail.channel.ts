import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { Mailer } from '../../mail/mailer';
import { User } from '../../users/user.entity';
import { MailRecipient } from '../notification';
import {
  NotificationChannel,
  NotificationDelivery,
} from './notification-channel';

// Mails each user at their email. Sent one by one, so one failure does not
// stop the others.
@Injectable()
export class MailChannel implements NotificationChannel {
  private readonly appUrl: string;

  constructor(
    private readonly em: EntityManager,
    private readonly mailer: Mailer,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true });
  }

  async send(deliveries: NotificationDelivery[]): Promise<void> {
    const recipients = await this.findRecipients(
      deliveries.map(({ userId }) => userId),
    );
    const results = await Promise.allSettled(
      deliveries.map(async ({ userId, notification }) => {
        // Deleted since the notification was sent.
        const recipient = recipients.get(userId);
        if (!recipient) {
          return;
        }
        const mail = notification.toMail(recipient).render(this.appUrl);
        await this.mailer.send({ to: recipient.email, ...mail });
      }),
    );

    const errors = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason as unknown] : [],
    );
    if (errors.length) {
      throw new AggregateError(
        errors,
        `${errors.length} of ${deliveries.length} mail(s) failed`,
      );
    }
  }

  private async findRecipients(
    userIds: string[],
  ): Promise<Map<string, MailRecipient>> {
    // Forked, so the partly loaded users stay out of the request's identity map.
    const users = await this.em
      .fork()
      .find(
        User,
        { id: { $in: userIds } },
        { fields: ['id', 'email', 'nickname'] },
      );
    return new Map(
      users.map(({ id, email, nickname }) => [id, { id, email, nickname }]),
    );
  }
}
