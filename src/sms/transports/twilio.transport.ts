import type { Twilio } from 'twilio';
import { Sms, SmsTransport } from '../sms-transport';

const TIMEOUT_MS = 10_000;

// Sends through Twilio's Messages API. The SDK is loaded only for this
// transport, as the others do not need its memory. It fails with a
// RestException, whose code explains why, such as 21211 for an invalid To.
export class TwilioTransport implements SmsTransport {
  private constructor(
    private readonly client: Twilio,
    // A number, an alphanumeric sender ID, or a messaging service SID (MG...).
    private readonly from: string,
  ) {}

  static async create(accountSid: string, authToken: string, from: string) {
    const { default: twilio } = await import('twilio');
    return new TwilioTransport(
      twilio(accountSid, authToken, { timeout: TIMEOUT_MS }),
      from,
    );
  }

  async send({ to, text }: Sms): Promise<void> {
    await this.client.messages.create({
      to,
      body: text,
      ...(/^MG[0-9a-f]{32}$/.test(this.from)
        ? { messagingServiceSid: this.from }
        : { from: this.from }),
    });
  }
}
