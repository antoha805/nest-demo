import { NotifiableUser } from './notifiable-user';

describe('NotifiableUser', () => {
  it('routes mail to the email and SMS to the phone', () => {
    const user = new NotifiableUser(
      'id',
      'ann',
      'ann@example.com',
      '+4915112345678',
    );

    expect(user.routeNotificationFor('mail')).toBe('ann@example.com');
    expect(user.routeNotificationFor('sms')).toBe('+4915112345678');
  });

  it('has no SMS route without a phone', () => {
    const user = NotifiableUser.from({
      id: 'id',
      nickname: 'ann',
      email: 'ann@example.com',
      phone: null,
    });

    expect(user.routeNotificationFor('sms')).toBeNull();
  });
});
