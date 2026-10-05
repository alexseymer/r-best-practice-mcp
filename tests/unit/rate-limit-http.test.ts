import { parseTrustProxy } from '../../src/middleware/trust-proxy';
import { startTestServer, TestServer } from '../helpers/web';

describe('parseTrustProxy', () => {
  it('defaults to false and never trusts when unset', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
  });
  it('parses true, hop counts and passes other values through', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy(' 2 ')).toBe(2);
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy('10.0.0.0/8, loopback')).toBe('10.0.0.0/8, loopback');
  });
});

async function hit(base: string, route: string, xff?: string): Promise<Response> {
  const res = await fetch(base + route, { headers: xff ? { 'x-forwarded-for': xff } : {} });
  await res.arrayBuffer();
  return res;
}

describe('rate limiting over HTTP', () => {
  describe('TRUST_PROXY unset', () => {
    let ts: TestServer;
    beforeAll(async () => {
      ts = await startTestServer({}, { rateLimit: { windowMs: 60000, maxRequests: 3 } });
    });
    afterAll(async () => {
      await ts.stop();
    });

    it('returns headers on the first request and 429 with Retry-After; spoofed XFF keeps one bucket', async () => {
      const first = await hit(ts.base, '/api/tools', '1.1.1.1');
      expect(first.status).toBe(200);
      expect(first.headers.get('x-ratelimit-limit')).toBe('3');
      expect(first.headers.get('x-ratelimit-remaining')).toBe('2');
      expect(first.headers.get('x-ratelimit-reset')).toBeTruthy();

      const second = await hit(ts.base, '/api/tools', '2.2.2.2');
      expect(second.headers.get('x-ratelimit-remaining')).toBe('1');
      const third = await hit(ts.base, '/api/tools', '3.3.3.3');
      expect(third.headers.get('x-ratelimit-remaining')).toBe('0');

      const blocked = await fetch(ts.base + '/api/tools', {
        headers: { 'x-forwarded-for': '4.4.4.4' },
      });
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
      expect(blocked.headers.get('x-ratelimit-remaining')).toBe('0');
      const body = await blocked.json();
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.retryAfter).toBe(Number(blocked.headers.get('retry-after')));
    });

    it('does not count or limit /health', async () => {
      for (let i = 0; i < 6; i++) {
        const r = await hit(ts.base, '/health');
        expect(r.status).toBe(200);
        expect(r.headers.get('x-ratelimit-limit')).toBeNull();
      }
    });
  });

  describe('TRUST_PROXY=loopback', () => {
    let ts: TestServer;
    beforeAll(async () => {
      ts = await startTestServer(
        { TRUST_PROXY: 'loopback' },
        { rateLimit: { windowMs: 60000, maxRequests: 2 } }
      );
    });
    afterAll(async () => {
      await ts.stop();
    });

    it('honours X-Forwarded-For from the trusted proxy', async () => {
      expect((await hit(ts.base, '/api/tools', '9.9.9.1')).status).toBe(200);
      expect((await hit(ts.base, '/api/tools', '9.9.9.1')).status).toBe(200);
      expect((await hit(ts.base, '/api/tools', '9.9.9.1')).status).toBe(429);
      // another client behind the proxy has its own budget
      expect((await hit(ts.base, '/api/tools', '9.9.9.2')).status).toBe(200);
    });
  });
});
