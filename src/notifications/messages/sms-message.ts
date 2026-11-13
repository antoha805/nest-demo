// What Notification.toSms returns, like Laravel's VonageMessage: plain text.
//
//   new SmsMessage().content(`${commenter} commented on "${title}".`);
export class SmsMessage {
  private text = '';

  content(text: string): this {
    this.text = text;
    return this;
  }

  render(): string {
    const text = this.text.trim();
    if (!text) {
      throw new Error('An SMS needs content');
    }
    return text;
  }
}
