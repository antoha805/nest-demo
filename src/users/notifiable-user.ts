import type {
  Notifiable,
  RoutedChannelName,
} from '../notifications/notifiable';
import type { PublicUser } from './public-user';
import type { User } from './user.entity';

// A user as notifications see them. Kept apart from the User entity, so the
// entity stays a database model.
export class NotifiableUser implements Notifiable, PublicUser {
  // The fields of a User it is made from.
  static readonly FIELDS = ['id', 'nickname', 'email', 'phone'] as const;

  constructor(
    readonly id: string,
    readonly nickname: string,
    readonly email: string,
    readonly phone: string | null,
  ) {}

  static from({
    id,
    nickname,
    email,
    phone,
  }: Pick<User, (typeof NotifiableUser.FIELDS)[number]>): NotifiableUser {
    return new NotifiableUser(id, nickname, email, phone);
  }

  routeNotificationFor(channel: RoutedChannelName): string | null {
    switch (channel) {
      case 'mail':
        return this.email;
      case 'sms':
        return this.phone;
    }
  }
}
