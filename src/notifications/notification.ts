export type NotificationChannelName = 'database' | 'broadcast';

// One subclass per kind of notification, like in Laravel, sent to users with
// NotificationsService.send. Users are identified by id.
export abstract class Notification<TData extends object = object> {
  // Lets clients tell the kinds apart, such as post.commented.
  abstract readonly type: string;

  // The channels that deliver this notification to the user. Subclasses can
  // choose by user, such as by their settings.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  via(userId: string): NotificationChannelName[] {
    return ['database', 'broadcast'];
  }

  // Stored, so it has to stay meaningful after the records it names change.
  abstract toDatabase(userId: string): TData;

  // Sent to the user's open streams.
  toBroadcast(userId: string): TData {
    return this.toDatabase(userId);
  }
}
