import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface HttpLikeError {
  status?: unknown;
  statusCode?: unknown;
  type?: unknown;
}

export interface ErrorBody {
  error: true;
  code: string;
  message: string;
}

/** Map any thrown value to the client-safe status and body. Never includes stack traces or paths. */
export function classifyError(err: unknown): { status: number; body: ErrorBody } {
  const e = (err ?? {}) as HttpLikeError;

  if (e.type === 'entity.parse.failed') {
    return {
      status: 400,
      body: { error: true, code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    };
  }
  if (e.type === 'entity.too.large') {
    return {
      status: 413,
      body: {
        error: true,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds the maximum allowed size',
      },
    };
  }

  const status = typeof e.status === 'number' ? e.status : e.statusCode;
  if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status < 500) {
    return {
      status,
      body: { error: true, code: 'BAD_REQUEST', message: 'The request could not be processed' },
    };
  }

  return {
    status: 500,
    body: { error: true, code: 'INTERNAL_ERROR', message: 'Internal server error' },
  };
}

/** Express error handler: status-aware, only 5xx are logged at error level. */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  const { status, body } = classifyError(err);
  if (status >= 500) {
    logger.error('Unhandled error', err);
  } else {
    logger.debug(`Client error ${status} on ${req.method} ${req.path}`, { code: body.code });
  }
  res.status(status).json(body);
}
