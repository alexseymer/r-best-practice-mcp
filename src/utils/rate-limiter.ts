import { createHash, randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { SecurityUtils } from './security.js';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimiterMiddlewareOptions {
  /** Requests for which this returns true neither consume budget nor receive rate-limit headers. */
  skip?: (req: Request) => boolean;
}

/**
 * Fixed-window, in-memory rate limiter keyed by the client address Express resolves (`req.ip`).
 * Forwarded headers are only honoured when the app's `trust proxy` setting says so.
 */
export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private windowMs: number; // Time window in milliseconds
  private maxRequests: number; // Max requests per window
  private message: string;
  private cleanupTimer?: NodeJS.Timeout;
  /** Per-process salt so exposed client identifiers cannot be reversed or correlated across restarts. */
  private salt = randomBytes(16);

  constructor(windowMs: number = 60000, maxRequests: number = 100, message?: string) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message || `Too many requests, please try again later.`;

    this.cleanupStaleEntries();
  }

  private cleanupStaleEntries(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.store.forEach((entry, key) => {
        if (entry.resetTime < now) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach((key) => this.store.delete(key));
    }, this.windowMs);
    // Never keep the process (or Jest) alive just for housekeeping
    this.cleanupTimer.unref();
  }

  /** Stop the cleanup timer. Safe to call more than once. */
  stop(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  middleware(options: RateLimiterMiddlewareOptions = {}) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (options.skip?.(req)) {
        return next();
      }

      const key = SecurityUtils.getClientIp(req);
      const now = Date.now();
      let entry = this.store.get(key);

      if (!entry || entry.resetTime < now) {
        entry = { count: 1, resetTime: now + this.windowMs };
        this.store.set(key, entry);
      } else {
        entry.count++;
      }

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - entry.count));
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

      if (entry.count > this.maxRequests) {
        const retryAfter = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({
          error: true,
          code: 'RATE_LIMIT_EXCEEDED',
          message: this.message,
          retryAfter,
        });
      }

      next();
    };
  }

  /** Short salted hash of a client key; the raw address is never exposed. */
  private anonymize(key: string): string {
    return createHash('sha256').update(this.salt).update(key).digest('hex').slice(0, 12);
  }

  getStats() {
    return {
      totalKeys: this.store.size,
      entries: Array.from(this.store.entries()).map(([key, entry]) => ({
        key: this.anonymize(key),
        count: entry.count,
        resetTime: new Date(entry.resetTime).toISOString(),
      })),
    };
  }
}
