import { Request, Response, NextFunction } from 'express';
import { SecurityUtils } from './security.js';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private windowMs: number; // Time window in milliseconds
  private maxRequests: number; // Max requests per window
  private message: string;
  private cleanupTimer?: NodeJS.Timeout;

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
    this.cleanupTimer.unref();
  }

  stop(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = SecurityUtils.getClientIp(req);
      const now = Date.now();
      let entry = this.store.get(key);

      if (!entry) {
        entry = { count: 1, resetTime: now + this.windowMs };
        this.store.set(key, entry);
        return next();
      }

      if (entry.resetTime < now) {
        entry.count = 1;
        entry.resetTime = now + this.windowMs;
        return next();
      }

      entry.count++;

      if (entry.count > this.maxRequests) {
        return res.status(429).json({
          error: true,
          code: 'RATE_LIMIT_EXCEEDED',
          message: this.message,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        });
      }

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - entry.count));
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

      next();
    };
  }

  getStats() {
    return {
      totalKeys: this.store.size,
      entries: Array.from(this.store.entries()).map(([key, entry]) => ({
        key,
        count: entry.count,
        resetTime: new Date(entry.resetTime).toISOString(),
      })),
    };
  }
}
