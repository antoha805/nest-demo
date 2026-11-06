import 'reflect-metadata';
import { validate } from './env.validation';

describe('validate', () => {
  const env = {
    DB_HOST: 'localhost',
    DB_PORT: '5433',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 's3cret',
    DB_NAME: 'nest_demo',
    JWT_SECRET: 'a'.repeat(32),
  };

  it('converts ports to numbers', () => {
    const result = validate({ ...env, PORT: '4000' });

    expect(result.PORT).toBe(4000);
    expect(result.DB_PORT).toBe(5433);
  });

  it('defaults PORT to 3000', () => {
    expect(validate(env).PORT).toBe(3000);
  });

  it('defaults LOG_TRANSPORTS to stdout', () => {
    expect(validate(env).LOG_TRANSPORTS).toEqual(['stdout']);
  });

  it('splits LOG_TRANSPORTS on commas', () => {
    const result = validate({ ...env, LOG_TRANSPORTS: 'stdout, file' });

    expect(result.LOG_TRANSPORTS).toEqual(['stdout', 'file']);
  });

  it.each(['slack', 'stdout,slack', '', 'file,file'])(
    'rejects LOG_TRANSPORTS=%j',
    (LOG_TRANSPORTS) => {
      expect(() => validate({ ...env, LOG_TRANSPORTS })).toThrow(
        /LOG_TRANSPORTS/,
      );
    },
  );

  it('rejects a missing variable', () => {
    expect(() => validate({ ...env, DB_HOST: undefined })).toThrow(/DB_HOST/);
  });

  it('defaults JWT_EXPIRES_IN to an hour', () => {
    expect(validate(env).JWT_EXPIRES_IN).toBe(3600);
  });

  it.each([undefined, 'too-short'])('rejects JWT_SECRET=%j', (JWT_SECRET) => {
    expect(() => validate({ ...env, JWT_SECRET })).toThrow(/JWT_SECRET/);
  });

  it('rejects a non-numeric port', () => {
    expect(() => validate({ ...env, DB_PORT: 'abc' })).toThrow(/DB_PORT/);
  });

  it('does not expose values in the error message', () => {
    expect(() => validate({ ...env, DB_PORT: 'abc' })).not.toThrow(/s3cret/);
  });

  it('defaults APP_URL to localhost', () => {
    expect(validate(env).APP_URL).toBe('http://localhost:3000');
  });

  it.each(['example.com', 'ftp://example.com', ''])(
    'rejects APP_URL=%j',
    (APP_URL) => {
      expect(() => validate({ ...env, APP_URL })).toThrow(/APP_URL/);
    },
  );

  it('needs no mail settings, as mails are then logged', () => {
    expect(validate(env)).toMatchObject({
      MAIL_URL: undefined,
      MAIL_FROM: undefined,
    });
  });

  it('accepts SMTP settings', () => {
    const result = validate({
      ...env,
      MAIL_URL: 'smtps://user:pass@smtp.example.com:465',
      MAIL_FROM: 'nest-demo <noreply@example.com>',
    });

    expect(result.MAIL_URL).toBe('smtps://user:pass@smtp.example.com:465');
  });

  it('requires MAIL_FROM with MAIL_URL', () => {
    expect(() =>
      validate({ ...env, MAIL_URL: 'smtp://localhost:1025' }),
    ).toThrow(/MAIL_FROM/);
  });

  it('rejects a MAIL_URL that is not SMTP, without showing it', () => {
    const MAIL_URL = 'https://user:s3cret@example.com';

    expect(() => validate({ ...env, MAIL_URL, MAIL_FROM: 'a' })).toThrow(
      /MAIL_URL/,
    );
    expect(() => validate({ ...env, MAIL_URL, MAIL_FROM: 'a' })).not.toThrow(
      /s3cret/,
    );
  });
});
