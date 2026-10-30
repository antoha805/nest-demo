import { buildLogTransport } from './log-transports';

describe('buildLogTransport', () => {
  it('uses no transport for stdout alone', () => {
    expect(buildLogTransport(['stdout'], 'info')).toBeUndefined();
  });

  it('creates one target per transport at the given level', () => {
    const transport = buildLogTransport(['stdout', 'file'], 'debug');

    expect(transport?.targets).toEqual([
      expect.objectContaining({ options: { destination: 1 }, level: 'debug' }),
      expect.objectContaining({
        options: { destination: 'logs/app.log', mkdir: true },
        level: 'debug',
      }),
    ]);
  });
});
