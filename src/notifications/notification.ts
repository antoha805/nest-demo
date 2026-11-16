import type { NotifiableUser } from '../users/notifiable-user';
import { MailMessage } from './messages/mail-message';
import { SmsMessage } from './messages/sms-message';
import type { Notifiable } from './notifiable';

export type NotificationChannelName = 'database' | 'broadcast' | 'mail' | 'sms';

// One subclass per kind of notification, like in Laravel, sent with
// NotificationsService.send. Each method gets the notifiable it is for: a
// NotifiableUser, unless a subclass is for another kind.
export abstract class Notification<
  TData extends object = object,
  N extends Notifiable = NotifiableUser,
> {
  // Lets clients tell the kinds apart, such as post.commented.
  abstract readonly type: string;

  // The channels that deliver this notification to the notifiable. Subclasses
  // can choose by notifiable, such as by their settings. Mail and SMS are left
  // out by default, as they need toMail and toSms.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  via(notifiable: N): NotificationChannelName[] {
    return ['database', 'broadcast'];
  }

  // Stored, so it has to stay meaningful after the records it names change.
  abstract toDatabase(notifiable: N): TData;

  // Sent to the notifiable's open streams.
  toBroadcast(notifiable: N): TData {
    return this.toDatabase(notifiable);
  }

  // Needed by notifications that list mail in via.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toMail(notifiable: N): MailMessage {
    throw new Error(`${this.type} lists mail in via but has no toMail`);
  }

  // Needed by notifications that list sms in via.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toSms(notifiable: N): SmsMessage {
    throw new Error(`${this.type} lists sms in via but has no toSms`);
  }
}
