import { RateLimiter } from '../../src/rate-limit';

describe('RateLimiter', () => {
  it('allows up to the limit and then blocks with a retry time', () => {
    const limiter = new RateLimiter(2, 60_000);
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('a', 1).allowed).toBe(true);
    const blocked = limiter.check('a', 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('counts each key on its own', () => {
    const limiter = new RateLimiter(1);
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
    expect(limiter.check('a', 1).allowed).toBe(false);
  });

  it('starts a new window after the old one ends', () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('a', 500).allowed).toBe(false);
    expect(limiter.check('a', 1001).allowed).toBe(true);
  });

  it('is off when the limit is 0', () => {
    const limiter = new RateLimiter(0);
    for (let i = 0; i < 100; i++) expect(limiter.check('a', i).allowed).toBe(true);
  });
});
