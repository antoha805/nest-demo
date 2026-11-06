import { BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';

// Shaped like a stored notification, so clients can add it to their list.
export interface BroadcastNotification {
  id: string;
  type: string;
  data: object;
  // Null when sent. A replayed one may have been read since.
  readAt: Date | null;
  createdAt: Date;
}

// Hands notifications to the streams of their user. Kept in memory, which works
// while a single instance of the app runs. More would need to share them, such
// as through Postgres LISTEN/NOTIFY.
@Injectable()
export class NotificationBroadcaster implements BeforeApplicationShutdown {
  private readonly subscribers = new Map<
    string,
    Set<Subscriber<BroadcastNotification>>
  >();

  publish(userId: string, notification: BroadcastNotification): void {
    for (const subscriber of this.subscribers.get(userId) ?? []) {
      subscriber.next(notification);
    }
  }

  subscribe(userId: string): Observable<BroadcastNotification> {
    return new Observable((subscriber) => {
      let subscribers = this.subscribers.get(userId);
      if (!subscribers) {
        subscribers = new Set();
        this.subscribers.set(userId, subscribers);
      }
      subscribers.add(subscriber);

      return () => {
        subscribers.delete(subscriber);
        if (!subscribers.size && this.subscribers.get(userId) === subscribers) {
          this.subscribers.delete(userId);
        }
      };
    });
  }

  // Ends the streams, as the server cannot close while they are open. Clients
  // reconnect once the app is back, and catch up on what they missed.
  beforeApplicationShutdown(): void {
    for (const subscribers of [...this.subscribers.values()]) {
      for (const subscriber of [...subscribers]) {
        subscriber.complete();
      }
    }
  }
}
