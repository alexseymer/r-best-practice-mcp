/** A fixed-window request counter per key, kept in memory. Enough to stop one client from hogging a free server. */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000
  ) {}

  /** `limit` of 0 turns the limiter off. */
  check(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    if (this.limit <= 0) return { allowed: true, retryAfterSeconds: 0 };

    if (this.hits.size > 10_000) this.purge(now);

    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private purge(now: number): void {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}
