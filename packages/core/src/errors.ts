/**
 * Centralized error taxonomy (Spec §94). API/route handlers map these to a
 * consistent problem shape without leaking internals (Spec §35).
 */

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'VALIDATION'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  VALIDATION: 422,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** Whether the message is safe to expose to clients. */
  readonly expose: boolean;

  constructor(code: ErrorCode, message: string, options?: { details?: unknown; expose?: boolean }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = options?.details;
    this.expose = options?.expose ?? code !== 'INTERNAL';
  }
}

export const badRequest = (m: string, details?: unknown) =>
  new AppError('BAD_REQUEST', m, { details });
export const unauthorized = (m = 'Authentication required') => new AppError('UNAUTHORIZED', m);
export const forbidden = (m = 'You do not have permission to perform this action') =>
  new AppError('FORBIDDEN', m);
export const notFound = (m = 'Not found') => new AppError('NOT_FOUND', m);
export const conflict = (m: string) => new AppError('CONFLICT', m);
export const validationError = (m: string, details?: unknown) =>
  new AppError('VALIDATION', m, { details });

/** Convert any thrown value into a client-safe problem object. */
export function toProblem(err: unknown): {
  status: number;
  body: { error: { code: ErrorCode; message: string; details?: unknown } };
} {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: {
        error: {
          code: err.code,
          message: err.expose ? err.message : 'An unexpected error occurred',
          ...(err.expose && err.details !== undefined ? { details: err.details } : {}),
        },
      },
    };
  }
  return {
    status: 500,
    body: { error: { code: 'INTERNAL', message: 'An unexpected error occurred' } },
  };
}
