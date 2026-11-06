import { Injectable } from '@nestjs/common';
import { NotificationBroadcaster } from '../notification-broadcaster';
import {
  NotificationChannel,
  NotificationDelivery,
} from './notification-channel';

// Delivers to the streams the user has open, so only while they are connected.
@Injectable()
export class BroadcastChannel implements NotificationChannel {
  constructor(private readonly broadcaster: NotificationBroadcaster) {}

  send(deliveries: NotificationDelivery[]): void {
    for (const { id, userId, notification, createdAt } of deliveries) {
      this.broadcaster.publish(userId, {
        id,
        type: notification.type,
        data: notification.toBroadcast(userId),
        readAt: null,
        createdAt,
      });
    }
  }
}
