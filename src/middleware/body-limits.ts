import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { LARGE_BODY_ROUTES } from '../config/runtime.js';

export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024; // 1 MB

/** Global body limit in bytes: env MAX_BODY_BYTES (positive integer) or 1 MB. */
export function getMaxBodyBytes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = (env.MAX_BODY_BYTES ?? '').trim();
  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (n > 0 && Number.isSafeInteger(n)) return n;
  }
  return DEFAULT_MAX_BODY_BYTES;
}

/**
 * Body parsers: JSON and urlencoded with the global limit, except for the exact paths in
 * `largeRoutes` (path -> limit in bytes), which are parsed as JSON with their own limit.
 * Oversized bodies surface as `entity.too.large` and become 413 in the error handler.
 */
export function bodyParsers(
  maxBytes: number,
  largeRoutes: Readonly<Record<string, number>> = LARGE_BODY_ROUTES
): RequestHandler {
  const globalJson = express.json({ limit: maxBytes });
  const globalUrlencoded = express.urlencoded({ limit: maxBytes, extended: true });
  const largeJson = new Map<string, RequestHandler>(
    Object.entries(largeRoutes).map(([route, limit]) => [route, express.json({ limit })])
  );

  return (req: Request, res: Response, next: NextFunction): void => {
    const large = largeJson.get(req.path);
    if (large) {
      large(req, res, next);
      return;
    }
    globalJson(req, res, (err?: unknown) => {
      if (err) return next(err);
      globalUrlencoded(req, res, next);
    });
  };
}
