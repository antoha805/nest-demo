import { Injectable } from '@nestjs/common';
import { Notification } from '../notification';

// A notification as a queued job holds it: its type and the data to make it
// again, such as the ids of the records it is about, like Laravel stores the
// models of a queued notification. Made again when the job runs, so it shows
// those records as they are then.
export interface QueuedNotification<TData extends object = object> {
  type: string;
  data: TData;
}

// Makes a notification from its queued data, or null to send nothing, such as
// once the record it is about has been deleted.
export type NotificationFactory<TData extends object = object> = (
  data: TData,
) => Promise<Notification | null>;

// The factories of the notifications that can be queued, registered by the
// modules that own them, by type.
@Injectable()
export class QueuedNotifications {
  private readonly factories = new Map<string, NotificationFactory>();

  register<TData extends object>(
    type: string,
    factory: NotificationFactory<TData>,
  ): void {
    if (this.factories.has(type)) {
      throw new Error(`A factory for ${type} is registered already`);
    }
    this.factories.set(type, factory);
  }

  make({ type, data }: QueuedNotification): Promise<Notification | null> {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`No factory is registered for ${type}`);
    }
    return factory(data);
  }
}
