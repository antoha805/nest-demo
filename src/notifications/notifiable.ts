import type { NotificationChannelName } from './notification';

// What kind of record a notification is for, stored with it, like Laravel's
// notifiable_type. A new kind needs a value here, which a migration adds to the
// enum, and a trigger that deletes its notifications along with the record.
export enum NotifiableType {
  USER = 'user',
}

// The channels that deliver to an address, such as an email.
export type RoutedChannelName = Extract<
  NotificationChannelName,
  'mail' | 'sms'
>;

// Who a notification goes to, like Laravel's Notifiable. The database channel
// files it under the type and id. Mail and SMS ask for an address, and skip
// notifiables without one.
export interface Notifiable {
  readonly notifiableType: NotifiableType;
  readonly id: string;

  routeNotificationFor(channel: RoutedChannelName): string | null;
}
