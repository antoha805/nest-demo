import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { DatabaseNotification } from '../database-notification.entity';
import {
  NotificationChannel,
  NotificationDelivery,
} from './notification-channel';

@Injectable()
export class DatabaseChannel implements NotificationChannel {
  constructor(private readonly em: EntityManager) {}

  async send(deliveries: NotificationDelivery[]): Promise<void> {
    await this.em.insertMany(
      DatabaseNotification,
      deliveries.map(({ id, userId, notification, createdAt }) => ({
        id,
        userId,
        type: notification.type,
        data: notification.toDatabase(userId),
        createdAt,
      })),
    );
  }
}
