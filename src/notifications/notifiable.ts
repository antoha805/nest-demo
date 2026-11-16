import type { NotificationChannelName } from './notification';

// The channels that deliver to an address, such as an email.
export type RoutedChannelName = Extract<
  NotificationChannelName,
  'mail' | 'sms'
>;

// Who a notification goes to, like Laravel's Notifiable. The database and
// broadcast channels file it under the id. Mail and SMS ask for an address,
// and skip notifiables without one.
export interface Notifiable {
  readonly id: string;

  routeNotificationFor(channel: RoutedChannelName): string | null;
}
