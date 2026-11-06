import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { Mail, Mailer } from './mailer';

describe('Mailer', () => {
  const mail: Mail = {
    to: 'ann@example.com',
    subject: 'Welcome',
    text: 'Hello!',
    html: '<p>Hello!</p>',
  };

  const create = async (env: Partial<EnvironmentVariables>) => {
    const config = {
      get: (key: keyof EnvironmentVariables) => env[key],
    } as unknown as ConfigService<EnvironmentVariables, true>;
    const mailer = new Mailer(config);
    await mailer.onModuleInit();
    return mailer;
  };

  afterEach(() => jest.restoreAllMocks());

  it('is off without MAIL_MAILER, and refuses to send', async () => {
    const mailer = await create({});

    expect(mailer.enabled).toBe(false);
    await expect(mailer.send(mail)).rejects.toThrow(/MAIL_MAILER/);
  });

  it('logs mails with the log mailer', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const mailer = await create({ MAIL_MAILER: 'log' });

    await mailer.send(mail);

    expect(mailer.enabled).toBe(true);
    expect(log).toHaveBeenCalledWith(
      { mail: { to: mail.to, subject: mail.subject, text: mail.text } },
      expect.stringContaining('Logged a mail'),
    );
  });

  it('sends through SES in AWS_REGION', async () => {
    const send = jest
      .spyOn(SESv2Client.prototype, 'send')
      .mockResolvedValue({ MessageId: 'ses-id' } as never);
    const mailer = await create({
      MAIL_MAILER: 'ses',
      MAIL_FROM: 'nest-demo <noreply@example.com>',
      AWS_REGION: 'eu-central-1',
    });

    await mailer.send(mail);

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0] as SendEmailCommand;
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect(command.input).toMatchObject({
      FromEmailAddress: '"nest-demo" <noreply@example.com>',
      Destination: { ToAddresses: ['ann@example.com'] },
    });
    const raw = command.input.Content?.Raw?.Data;
    expect(Buffer.from(raw!).toString()).toContain('Subject: Welcome');
    const client = send.mock.contexts[0] as SESv2Client;
    await expect(client.config.region()).resolves.toBe('eu-central-1');
  });
});
