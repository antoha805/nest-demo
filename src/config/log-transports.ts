const TRANSPORT_TARGETS = {
  stdout: { target: 'pino/file', options: { destination: 1 } },
  pretty: { target: 'pino-pretty' },
  file: {
    target: 'pino/file',
    options: { destination: 'logs/app.log', mkdir: true },
  },
};

export type LogTransport = keyof typeof TRANSPORT_TARGETS;

export const LOG_TRANSPORTS = Object.keys(TRANSPORT_TARGETS) as LogTransport[];

export function buildLogTransport(transports: LogTransport[], level: string) {
  // Plain stdout needs no transport, so it skips pino's worker thread.
  if (transports.length === 1 && transports[0] === 'stdout') {
    return undefined;
  }

  // A target without its own level defaults to info, whatever LOG_LEVEL is.
  return {
    targets: transports.map((transport) => ({
      ...TRANSPORT_TARGETS[transport],
      level,
    })),
  };
}
