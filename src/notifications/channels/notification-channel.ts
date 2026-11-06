import { Notification } from '../notification';

// One notification for one user.
export interface NotificationDelivery {
  // The same for every channel, so a broadcast names the stored notification.
  id: string;
  userId: string;
  notification: Notification;
  createdAt: Date;
}

export interface NotificationChannel {
  send(deliveries: NotificationDelivery[]): Promise<void> | void;
}
