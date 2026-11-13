import { SmsMessage } from './sms-message';

describe('SmsMessage', () => {
  it('renders the content, trimmed', () => {
    expect(new SmsMessage().content('  New comment \n').render()).toBe(
      'New comment',
    );
  });

  it.each(['', '  '])('requires content, not %j', (content) => {
    expect(() => new SmsMessage().content(content).render()).toThrow(/content/);
    expect(() => new SmsMessage().render()).toThrow(/content/);
  });
});
