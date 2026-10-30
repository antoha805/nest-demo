import 'reflect-metadata';
import { validate } from './env.validation';

describe('validate', () => {
  const env = {
    DB_HOST: 'localhost',
    DB_PORT: '5433',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 's3cret',
    DB_NAME: 'nest_demo',
  };

  it('converts ports to numbers', () => {
    const result = validate({ ...env, PORT: '4000' });

    expect(result.PORT).toBe(4000);
    expect(result.DB_PORT).toBe(5433);
  });

  it('defaults PORT to 3000', () => {
    expect(validate(env).PORT).toBe(3000);
  });

  it('rejects a missing variable', () => {
    expect(() => validate({ ...env, DB_HOST: undefined })).toThrow(/DB_HOST/);
  });

  it('rejects a non-numeric port', () => {
    expect(() => validate({ ...env, DB_PORT: 'abc' })).toThrow(/DB_PORT/);
  });

  it('does not expose values in the error message', () => {
    expect(() => validate({ ...env, DB_PORT: 'abc' })).not.toThrow(/s3cret/);
  });
});
