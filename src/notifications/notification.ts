import { PublicUser } from '../users/public-user';
import { MailMessage } from './messages/mail-message';
import { SmsMessage } from './messages/sms-message';

export type NotificationChannelName = 'database' | 'broadcast' | 'mail' | 'sms';

// Who a mail goes to, so it can address them by nickname.
export interface MailRecipient extends PublicUser {
  email: string;
}

// Who a text goes to: only users with a phone number get one.
export interface SmsRecipient extends PublicUser {
  phone: string;
}

// One subclass per kind of notification, like in Laravel, sent to users with
// NotificationsService.send. Users are identified by id.
export abstract class Notification<TData extends object = object> {
  // Lets clients tell the kinds apart, such as post.commented.
  abstract readonly type: string;

  // The channels that deliver this notification to the user. Subclasses can
  // choose by user, such as by their settings. Mail and SMS are left out by
  // default, as they need toMail and toSms.
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

  // Needed by notifications that list mail in via.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toMail(user: MailRecipient): MailMessage {
    throw new Error(`${this.type} lists mail in via but has no toMail`);
  }

  // Needed by notifications that list sms in via.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toSms(user: SmsRecipient): SmsMessage {
    throw new Error(`${this.type} lists sms in via but has no toSms`);
  }
}
