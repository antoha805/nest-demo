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

  it.each([undefined, ''])(
    'turns mail off for MAIL_MAILER=%j',
    (MAIL_MAILER) => {
      expect(validate({ ...env, MAIL_MAILER }).MAIL_MAILER).toBeUndefined();
    },
  );

  it('needs no other mail settings for the log mailer', () => {
    expect(validate({ ...env, MAIL_MAILER: 'log' }).MAIL_MAILER).toBe('log');
  });

  it.each(['sendmail', 'SMTP'])('rejects MAIL_MAILER=%j', (MAIL_MAILER) => {
    expect(() => validate({ ...env, MAIL_MAILER })).toThrow(/MAIL_MAILER/);
  });

  describe('with the smtp mailer', () => {
    const smtp = {
      ...env,
      MAIL_MAILER: 'smtp',
      MAIL_URL: 'smtps://user:pass@smtp.example.com:465',
      MAIL_FROM: 'nest-demo <noreply@example.com>',
    };

    it('accepts the SMTP settings', () => {
      expect(validate(smtp)).toMatchObject({
        MAIL_URL: smtp.MAIL_URL,
        MAIL_FROM: smtp.MAIL_FROM,
      });
    });

    it.each(['MAIL_URL', 'MAIL_FROM'])('requires %s', (name) => {
      expect(() => validate({ ...smtp, [name]: undefined })).toThrow(
        new RegExp(name),
      );
    });

    it('rejects a MAIL_URL that is not SMTP, without showing it', () => {
      const MAIL_URL = 'https://user:s3cret@example.com';

      expect(() => validate({ ...smtp, MAIL_URL })).toThrow(/MAIL_URL/);
      expect(() => validate({ ...smtp, MAIL_URL })).not.toThrow(/s3cret/);
    });
  });

  it('ignores the SMTP settings for other mailers', () => {
    expect(() =>
      validate({ ...env, MAIL_MAILER: 'log', MAIL_URL: 'not a url' }),
    ).not.toThrow();
  });
});
