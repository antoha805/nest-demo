import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { LOG_TRANSPORTS, LogTransport } from './log-transports';

// smtp sends through MAIL_URL, ses through Amazon SES, and log writes mails to
// the log, as in development.
export const MAIL_MAILERS = ['smtp', 'ses', 'log'] as const;

export type MailMailer = (typeof MAIL_MAILERS)[number];

// sns sends through Amazon SNS, twilio through Twilio, and log writes texts to
// the log, as in development.
export const SMS_DRIVERS = ['sns', 'twilio', 'log'] as const;

export type SmsDriver = (typeof SMS_DRIVERS)[number];

export class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL: string = 'info';

  @Transform(({ value }: { value: string }) =>
    value
      .split(',')
      .map((transport) => transport.trim())
      .filter(Boolean),
  )
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(LOG_TRANSPORTS, { each: true })
  LOG_TRANSPORTS: LogTransport[] = ['stdout'];

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  JWT_EXPIRES_IN: number = 3600;

  // The app's own URL, like Laravel's, which links in mails start with.
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  APP_URL: string = 'http://localhost:3000';

  // How mails are sent, like Laravel's. Unset or empty turns mail off, and
  // notifications leave out the mail channel.
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
  @IsOptional()
  @IsIn(MAIL_MAILERS)
  MAIL_MAILER?: MailMailer;

  // Holds the password, so its error does not show it.
  @ValidateIf((env: EnvironmentVariables) => env.MAIL_MAILER === 'smtp')
  @Matches(/^smtps?:\/\/\S+$/, {
    message: 'MAIL_URL must be an smtp:// or smtps:// URL',
  })
  MAIL_URL?: string;

  @ValidateIf((env: EnvironmentVariables) =>
    ['smtp', 'ses'].includes(env.MAIL_MAILER as string),
  )
  @IsString()
  @IsNotEmpty()
  MAIL_FROM?: string;

  // How texts are sent. Unset or empty turns SMS off, and notifications leave
  // out the sms channel.
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
  @IsOptional()
  @IsIn(SMS_DRIVERS)
  SMS_DRIVER?: SmsDriver;

  // The sender: for twilio, a number of the account, an alphanumeric sender ID
  // or a messaging service SID (MG...); for sns, an optional sender ID, where
  // the destination country allows one.
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
  @ValidateIf(
    (env: EnvironmentVariables) =>
      env.SMS_DRIVER === 'twilio' || env.SMS_FROM !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  SMS_FROM?: string;

  @ValidateIf((env: EnvironmentVariables) => env.SMS_DRIVER === 'twilio')
  @Matches(/^AC[0-9a-f]{32}$/, {
    message: 'TWILIO_ACCOUNT_SID must be a Twilio account SID, such as AC...',
  })
  TWILIO_ACCOUNT_SID?: string;

  // A secret, so its error does not show it.
  @ValidateIf((env: EnvironmentVariables) => env.SMS_DRIVER === 'twilio')
  @IsString({ message: 'TWILIO_AUTH_TOKEN must be set' })
  @IsNotEmpty({ message: 'TWILIO_AUTH_TOKEN must be set' })
  TWILIO_AUTH_TOKEN?: string;

  // The SES and SNS region, such as eu-central-1. The AWS SDK finds the
  // credentials, such as in AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or the
  // EC2 instance's role.
  @ValidateIf(
    (env: EnvironmentVariables) =>
      env.MAIL_MAILER === 'ses' || env.SMS_DRIVER === 'sns',
  )
  @Matches(/^[a-z]{2}(-[a-z]+)+-\d+$/, {
    message: 'AWS_REGION must be an AWS region, such as eu-central-1',
  })
  AWS_REGION?: string;
}

export function validate(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env);

  if (errors.length > 0) {
    // Report constraints only: the error's target and value hold secrets.
    const details = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new Error(`Invalid environment variables:\n${details.join('\n')}`);
  }

  return env;
}
