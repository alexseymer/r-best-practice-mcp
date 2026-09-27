import { RateLimiter } from '../../src/utils/rate-limiter';
import { Request, Response } from 'express';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(1000, 5); // 5 requests per 1 second for testing
  });

  describe('middleware', () => {
    it('should allow requests under the limit', () => {
      const middleware = limiter.middleware();
      let nextCalled = false;

      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as any;

      const next = jest.fn(() => {
        nextCalled = true;
      });

      for (let i = 0; i < 5; i++) {
        middleware(req, res, next);
      }

      expect(nextCalled).toBe(true);
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should reject requests exceeding the limit', () => {
      const middleware = limiter.middleware();

      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as any;

      const next = jest.fn();

      // Make 6 requests (limit is 5)
      for (let i = 0; i < 6; i++) {
        middleware(req, res, next);
      }

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          code: 'RATE_LIMIT_EXCEEDED',
        })
      );
    });

    it('should set rate limit headers on responses', () => {
      const middleware = limiter.middleware();

      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as any;

      const next = jest.fn();

      // Make second request to ensure entry exists
      middleware(req, res, next);
      res.setHeader.mockClear();
      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 3);
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String)
      );
    });

    it('should track different IPs separately', () => {
      const middleware = limiter.middleware();

      const req1 = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const req2 = {
        headers: {},
        socket: { remoteAddress: '192.168.1.2' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as any;

      const next = jest.fn();

      // Max out first IP
      for (let i = 0; i < 6; i++) {
        middleware(req1, res, next);
      }

      // Second IP should not be rate limited
      res.status.mockClear();
      middleware(req2, res, next);

      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should extract IP from X-Forwarded-For header', () => {
      const middleware = limiter.middleware();

      const req = {
        headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' },
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as any;

      const next = jest.fn();

      // Make requests with forwarded IP
      for (let i = 0; i < 5; i++) {
        middleware(req, res, next);
      }

      // The 6th should be rate limited for that specific IP
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should reset counter after window expires', async () => {
      limiter = new RateLimiter(100, 2); // 100ms window, 2 requests
      const middleware = limiter.middleware();

      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as any;

      const next = jest.fn();

      // Make 2 requests
      for (let i = 0; i < 2; i++) {
        middleware(req, res, next);
      }

      // 3rd should be rate limited
      res.status.mockClear();
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should allow requests again after reset
      res.status.mockClear();
      middleware(req, res, next);
      expect(res.status).not.toHaveBeenCalledWith(429);
    });
  });

  describe('getStats', () => {
    it('should return rate limit statistics', () => {
      const middleware = limiter.middleware();

      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as any;

      const next = jest.fn();

      middleware(req, res, next);

      const stats = limiter.getStats();
      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('entries');
      expect(stats.totalKeys).toBeGreaterThan(0);
    });

    it('should show correct request count in stats', () => {
      const middleware = limiter.middleware();

      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as any;

      const next = jest.fn();

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        middleware(req, res, next);
      }

      const stats = limiter.getStats();
      const entry = stats.entries[0];
      expect(entry.count).toBe(3);
    });
  });

  describe('custom message', () => {
    it('should use custom message in response', () => {
      const customMessage = 'Custom rate limit message';
      limiter = new RateLimiter(1000, 2, customMessage);
      const middleware = limiter.middleware();

      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as any;

      const next = jest.fn();

      // Exceed limit
      for (let i = 0; i < 3; i++) {
        middleware(req, res, next);
      }

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: customMessage,
        })
      );
    });
  });
});
