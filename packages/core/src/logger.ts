import pino, { type Logger } from 'pino';

/**
 * Structured application logger (Spec §72). One base logger; use `.child()`
 * to add per-request / per-job context (traceId, userId, jobId).
 */
export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  // Never log secrets/tokens.
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      '*.password',
      '*.token',
      'headers.authorization',
      'headers.cookie',
    ],
    censor: '[redacted]',
  },
});

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
