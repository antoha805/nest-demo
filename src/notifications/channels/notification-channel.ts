import { Notifiable } from '../notifiable';
import { Notification } from '../notification';

// One notification for one notifiable.
export interface NotificationDelivery {
  // The same for every channel, so a broadcast names the stored notification.
  id: string;
  notifiable: Notifiable;
  notification: Notification<object, Notifiable>;
  createdAt: Date;
}

export interface NotificationChannel {
  send(deliveries: NotificationDelivery[]): Promise<void> | void;
}

// Sends each delivery on its own, so one failure does not stop the others, and
// then throws all failures together.
export async function sendEach(
  deliveries: NotificationDelivery[],
  send: (delivery: NotificationDelivery) => Promise<void>,
  what: string,
): Promise<void> {
  const results = await Promise.allSettled(deliveries.map(send));
  const errors = results.flatMap((result) =>
    result.status === 'rejected' ? [result.reason as unknown] : [],
  );
  if (errors.length) {
    throw new AggregateError(
      errors,
      `${errors.length} of ${deliveries.length} ${what} failed`,
    );
  }
}
