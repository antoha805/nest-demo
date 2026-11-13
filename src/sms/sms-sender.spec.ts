import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { Logger } from '@nestjs/common';
import RequestClient from 'twilio/lib/base/RequestClient';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { Sms } from './sms-transport';
import { SmsSender } from './sms-sender';

describe('SmsSender', () => {
  const sms: Sms = { to: '+4915112345678', text: 'Hello!' };
  const accountSid = `AC${'a'.repeat(32)}`;

  const create = async (env: Partial<EnvironmentVariables>) => {
    const config = {
      get: (key: keyof EnvironmentVariables) => env[key],
    } as unknown as ConfigService<EnvironmentVariables, true>;
    const sender = new SmsSender(config);
    await sender.onModuleInit();
    return sender;
  };

  afterEach(() => jest.restoreAllMocks());

  it('is off without SMS_DRIVER, and refuses to send', async () => {
    const sender = await create({});

    expect(sender.enabled).toBe(false);
    await expect(sender.send(sms)).rejects.toThrow(/SMS_DRIVER/);
  });

  it('logs texts with the log driver', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const sender = await create({ SMS_DRIVER: 'log' });

    await sender.send(sms);

    expect(sender.enabled).toBe(true);
    expect(log).toHaveBeenCalledWith(
      { sms },
      expect.stringContaining('Logged an SMS'),
    );
  });

  describe('with the sns driver', () => {
    it('publishes to the number in AWS_REGION as transactional', async () => {
      const send = jest
        .spyOn(SNSClient.prototype, 'send')
        .mockResolvedValue({ MessageId: 'sns-id' } as never);
      const sender = await create({
        SMS_DRIVER: 'sns',
        SMS_FROM: 'NestDemo',
        AWS_REGION: 'eu-central-1',
      });

      await sender.send(sms);

      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0] as PublishCommand;
      expect(command).toBeInstanceOf(PublishCommand);
      expect(command.input).toEqual({
        PhoneNumber: sms.to,
        Message: sms.text,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue: 'NestDemo',
          },
        },
      });
      const client = send.mock.contexts[0] as SNSClient;
      await expect(client.config.region()).resolves.toBe('eu-central-1');
      sender.onModuleDestroy();
    });

    it('leaves out the sender ID without SMS_FROM', async () => {
      const send = jest
        .spyOn(SNSClient.prototype, 'send')
        .mockResolvedValue({} as never);
      const sender = await create({
        SMS_DRIVER: 'sns',
        AWS_REGION: 'eu-central-1',
      });

      await sender.send(sms);

      const command = send.mock.calls[0][0] as PublishCommand;
      expect(command.input.MessageAttributes).not.toHaveProperty([
        'AWS.SNS.SMS.SenderID',
      ]);
      sender.onModuleDestroy();
    });
  });

  describe('with the twilio driver', () => {
    const twilio = (from: string) =>
      create({
        SMS_DRIVER: 'twilio',
        SMS_FROM: from,
        TWILIO_ACCOUNT_SID: accountSid,
        TWILIO_AUTH_TOKEN: 'token',
      });
    // Twilio's HTTP client, so the SDK builds the request as it would.
    const mockRequest = (statusCode: number, body: object) =>
      jest
        .spyOn(RequestClient.prototype, 'request')
        .mockResolvedValue({ statusCode, body, headers: {} });

    it('creates a message from SMS_FROM with the account credentials', async () => {
      const request = mockRequest(201, { sid: 'SM1' });
      const sender = await twilio('+15005550006');

      await sender.send(sms);

      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0][0]).toMatchObject({
        method: 'post',
        uri: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        data: { To: sms.to, Body: sms.text, From: '+15005550006' },
      });
      const client = request.mock.contexts[0] as RequestClient;
      expect(client.defaultTimeout).toBe(10_000);
    });

    it('sends from a messaging service given its SID', async () => {
      const request = mockRequest(201, { sid: 'SM1' });
      const service = `MG${'b'.repeat(32)}`;
      const sender = await twilio(service);

      await sender.send(sms);

      const { data } = request.mock.calls[0][0];
      expect(data).toMatchObject({ MessagingServiceSid: service });
      expect(data).not.toHaveProperty('From');
    });

    it("fails with Twilio's error", async () => {
      mockRequest(400, {
        code: 21211,
        message: "The 'To' number is not valid.",
      });
      const sender = await twilio('+15005550006');

      await expect(sender.send(sms)).rejects.toMatchObject({
        status: 400,
        code: 21211,
        message: "The 'To' number is not valid.",
      });
    });
  });
});
