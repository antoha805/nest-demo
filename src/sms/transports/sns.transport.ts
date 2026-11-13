import type { SNSClient } from '@aws-sdk/client-sns';
import { Sms, SmsTransport } from '../sms-transport';

// Sends through Amazon SNS, straight to the number, with no topic. The SDK is
// loaded only for this transport, as the others do not need its memory.
export class SnsTransport implements SmsTransport {
  private constructor(
    private readonly client: SNSClient,
    private readonly PublishCommand: typeof import('@aws-sdk/client-sns').PublishCommand,
    private readonly senderId?: string,
  ) {}

  static async create(region: string, senderId?: string) {
    const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');
    return new SnsTransport(
      new SNSClient({ region }),
      PublishCommand,
      senderId,
    );
  }

  async send({ to, text }: Sms): Promise<void> {
    await this.client.send(
      new this.PublishCommand({
        PhoneNumber: to,
        Message: text,
        MessageAttributes: {
          // Notifications, so delivered reliably rather than cheaply.
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
          ...(this.senderId && {
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: this.senderId,
            },
          }),
        },
      }),
    );
  }

  close(): void {
    this.client.destroy();
  }
}
