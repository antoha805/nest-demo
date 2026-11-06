import { MailMessage } from '../../notifications/messages/mail-message';
import {
  MailRecipient,
  Notification,
  NotificationChannelName,
} from '../../notifications/notification';

// Mails the code that confirms a new user's email, like Laravel's VerifyEmail.
// Only mailed: the code must not be stored or sent anywhere else.
export class VerifyEmailNotification extends Notification {
  readonly type = 'auth.verify-email';

  constructor(
    private readonly code: string,
    private readonly validMinutes: number,
  ) {
    super();
  }

  via(): NotificationChannelName[] {
    return ['mail'];
  }

  // Never stored, as it is only mailed.
  toDatabase() {
    return {};
  }

  toMail(user: MailRecipient): MailMessage {
    return new MailMessage()
      .subject(`Your confirmation code: ${this.code}`)
      .greeting(`Hi ${user.nickname}!`)
      .line(`Your code to confirm your email is ${this.code}.`)
      .line(`It expires in ${this.validMinutes} minutes.`)
      .line(
        'If you did not create an account, you can ignore this mail: without the code, the account stays unconfirmed.',
      );
  }
}
