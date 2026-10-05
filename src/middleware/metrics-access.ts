import { createHash, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import type { RuntimeConfig } from '../config/runtime.js';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Constant-time string comparison (hashes first so lengths do not leak). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

/** Extract the token from `Authorization: Bearer <token>`; null if absent or malformed. */
export function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header ?? '');
  return match ? match[1] : null;
}

/**
 * Gate for `/metrics*` according to the runtime config:
 * - public: served as before
 * - tokenRequired: `Authorization: Bearer <METRICS_TOKEN>` or 401 with `WWW-Authenticate: Bearer`
 * - neither: 404, indistinguishable from a route that does not exist
 */
export function metricsAccess(metrics: RuntimeConfig['metrics'], token: string | undefined) {
  const expected = (token ?? '').trim();
  return (req: Request, res: Response, next: NextFunction): void => {
    if (metrics.public) {
      next();
      return;
    }
    if (metrics.tokenRequired && expected) {
      const supplied = bearerToken(req.headers.authorization);
      if (supplied !== null && safeEqual(supplied, expected)) {
        next();
        return;
      }
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({
        error: true,
        code: 'UNAUTHORIZED',
        message: 'A valid bearer token is required',
      });
      return;
    }
    res.status(404).json({
      error: true,
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`,
    });
  };
}
