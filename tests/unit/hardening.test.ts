import http from 'http';
import express from 'express';
import type { AddressInfo } from 'net';
import {
  API_DOCS_CSP,
  DASHBOARD_CSP,
  HSTS_VALUE,
  PERMISSIONS_POLICY,
  buildCsp,
  cspForPath,
} from '../../src/middleware/security-headers';
import { bodyParsers, getMaxBodyBytes } from '../../src/middleware/body-limits';
import { bearerToken, safeEqual } from '../../src/middleware/metrics-access';
import { startTestServer, postJson, TestServer } from '../helpers/web';

function rawGet(
  base: string,
  route: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    http
      .get(base + route, { headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        );
      })
      .on('error', reject);
  });
}

describe('CSP constants', () => {
  it('are self-hosted only: no third-party origins, no unsafe-inline, no unsafe-eval', () => {
    for (const policy of [DASHBOARD_CSP, API_DOCS_CSP]) {
      const csp = buildCsp(policy);
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self';");
      expect(csp).toContain("style-src 'self';");
      expect(csp).toContain("font-src 'self';");
      expect(csp).toContain("img-src 'self' data:");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toMatch(/https?:/);
      expect(csp).not.toContain('unsafe-inline');
      expect(csp).not.toContain('unsafe-eval');
    }
  });

  it('picks the policy by path', () => {
    expect(cspForPath('/api-docs')).toBe(buildCsp(API_DOCS_CSP));
    expect(cspForPath('/dashboard')).toBe(buildCsp(DASHBOARD_CSP));
    expect(cspForPath('/anything')).toBe(buildCsp(DASHBOARD_CSP));
  });
});

describe('metrics token helpers', () => {
  it('parses bearer tokens', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer   abc  ')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken('Bearer')).toBeNull();
    expect(bearerToken('Bearer a b')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
  it('compares in constant time over equal-length digests', () => {
    expect(safeEqual('secret', 'secret')).toBe(true);
    expect(safeEqual('secret', 'secreT')).toBe(false);
    expect(safeEqual('a', 'a-much-longer-value')).toBe(false);
  });
});

describe('getMaxBodyBytes', () => {
  it('defaults to 1 MB and accepts a positive integer override', () => {
    expect(getMaxBodyBytes({})).toBe(1024 * 1024);
    expect(getMaxBodyBytes({ MAX_BODY_BYTES: '2048' })).toBe(2048);
    expect(getMaxBodyBytes({ MAX_BODY_BYTES: '0' })).toBe(1024 * 1024);
    expect(getMaxBodyBytes({ MAX_BODY_BYTES: '-5' })).toBe(1024 * 1024);
    expect(getMaxBodyBytes({ MAX_BODY_BYTES: 'lots' })).toBe(1024 * 1024);
  });
});

describe('bodyParsers with LARGE_BODY_ROUTES-style map', () => {
  let server: http.Server;
  let base: string;
  beforeAll(async () => {
    const app = express();
    app.use(bodyParsers(1000, { '/big': 20000 }));
    app.post('*', (req, res) => res.json({ size: JSON.stringify(req.body).length }));
    app.use(
      (err: { status?: number }, _req: express.Request, res: express.Response, _n: unknown) => {
        res.status(err.status ?? 500).json({ error: true });
      }
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const payload = (n: number) => JSON.stringify({ x: 'a'.repeat(n) });

  it('applies the global limit to ordinary routes', async () => {
    expect((await postJson(base, '/small', payload(500))).status).toBe(200);
    expect((await postJson(base, '/small', payload(5000))).status).toBe(413);
  });

  it('gives the listed route its own limit, and only that exact path', async () => {
    expect((await postJson(base, '/big', payload(5000))).status).toBe(200);
    expect((await postJson(base, '/big', payload(30000))).status).toBe(413);
    expect((await postJson(base, '/big/other', payload(5000))).status).toBe(413);
  });
});

describe('hardening over HTTP', () => {
  let ts: TestServer;
  beforeAll(async () => {
    ts = await startTestServer({});
  });
  afterAll(async () => {
    await ts.stop();
  });

  it('sends security headers on pages, API, errors and static files', async () => {
    for (const route of ['/dashboard', '/dashboard.js', '/api/tools', '/health', '/nope']) {
      const r = await rawGet(ts.base, route);
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['x-frame-options']).toBe('DENY');
      expect(r.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(r.headers['permissions-policy']).toBe(PERMISSIONS_POLICY);
      expect(r.headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(r.headers['content-security-policy']).toBe(buildCsp(DASHBOARD_CSP));
      expect(r.headers['x-powered-by']).toBeUndefined();
      expect(r.headers['strict-transport-security']).toBeUndefined();
    }
  });

  it('uses the Swagger CSP variant on /api-docs', async () => {
    const r = await rawGet(ts.base, '/api-docs');
    expect(r.headers['content-security-policy']).toBe(buildCsp(API_DOCS_CSP));
  });

  it('never sends HSTS over plain HTTP, even with a spoofed X-Forwarded-Proto', async () => {
    const r = await rawGet(ts.base, '/health', { 'x-forwarded-proto': 'https' });
    expect(r.headers['strict-transport-security']).toBeUndefined();
  });

  it('sets no-store on API, health and metrics but not static files', async () => {
    for (const route of ['/api/tools', '/health', '/api/config', '/nope-api']) {
      const r = await rawGet(ts.base, route);
      if (route === '/nope-api') expect(r.headers['cache-control']).toBeUndefined();
      else expect(r.headers['cache-control']).toBe('no-store');
    }
    const js = await rawGet(ts.base, '/dashboard.js');
    expect(js.headers['cache-control']).not.toBe('no-store');
    expect(js.headers['etag']).toBeTruthy();
    const revalidated = await rawGet(ts.base, '/dashboard.js', {
      'if-none-match': js.headers['etag'] as string,
    });
    expect(revalidated.status).toBe(304);
  });

  it('gzips text responses when asked and not otherwise', async () => {
    const gz = await rawGet(ts.base, '/api/practices', { 'accept-encoding': 'gzip' });
    expect(gz.headers['content-encoding']).toBe('gzip');
    expect(String(gz.headers['vary'])).toMatch(/Accept-Encoding/i);
    const plain = await rawGet(ts.base, '/api/practices', { 'accept-encoding': 'identity' });
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(gz.body.length).toBeLessThan(plain.body.length);
    const js = await rawGet(ts.base, '/dashboard.js', { 'accept-encoding': 'gzip' });
    expect(js.headers['content-encoding']).toBe('gzip');
  });

  it('rejects bodies over the 1 MB default with 413 PAYLOAD_TOO_LARGE', async () => {
    const big = JSON.stringify({ path: 'a'.repeat(2 * 1024 * 1024) });
    const r = await postJson(ts.base, '/api/detect-workflow', big);
    expect(r.status).toBe(413);
    expect(r.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('accepts bodies below the limit', async () => {
    const r = await postJson(ts.base, '/api/generate-template', {
      workflow: 'package',
      projectName: 'x'.repeat(100_000),
    });
    expect(r.status).toBe(200);
  });
});

describe('HSTS behind a trusted proxy', () => {
  let ts: TestServer;
  beforeAll(async () => {
    ts = await startTestServer({ TRUST_PROXY: 'loopback' });
  });
  afterAll(async () => {
    await ts.stop();
  });

  it('is sent for forwarded HTTPS requests only', async () => {
    const https = await rawGet(ts.base, '/health', { 'x-forwarded-proto': 'https' });
    expect(https.headers['strict-transport-security']).toBe(HSTS_VALUE);
    const http1 = await rawGet(ts.base, '/health', { 'x-forwarded-proto': 'http' });
    expect(http1.headers['strict-transport-security']).toBeUndefined();
  });
});

describe('MAX_BODY_BYTES override', () => {
  it('lowers the global limit', async () => {
    const ts = await startTestServer({ MAX_BODY_BYTES: '200' });
    try {
      const r = await postJson(ts.base, '/api/detect-workflow', { path: 'a'.repeat(500) });
      expect(r.status).toBe(413);
      const ok = await postJson(ts.base, '/api/detect-workflow', { path: '' });
      expect(ok.status).toBe(400);
    } finally {
      await ts.stop();
    }
  });
});

describe('metrics access', () => {
  const routes = [
    '/metrics',
    '/metrics/rate-limit',
    '/metrics/requests.csv',
    '/metrics/operations.csv',
  ];

  it('public: served without credentials', async () => {
    const ts = await startTestServer({ METRICS_PUBLIC: 'true' });
    try {
      for (const route of routes) expect((await rawGet(ts.base, route)).status).toBe(200);
    } finally {
      await ts.stop();
    }
  });

  it('token required: 401 without or with a wrong token, 200 with the right one', async () => {
    const ts = await startTestServer({ NODE_ENV: 'production', METRICS_TOKEN: 's3cret-token' });
    try {
      for (const route of routes) {
        const none = await rawGet(ts.base, route);
        expect(none.status).toBe(401);
        expect(none.headers['www-authenticate']).toBe('Bearer');
        const wrong = await rawGet(ts.base, route, { authorization: 'Bearer nope' });
        expect(wrong.status).toBe(401);
        const basic = await rawGet(ts.base, route, { authorization: 'Basic s3cret-token' });
        expect(basic.status).toBe(401);
        const ok = await rawGet(ts.base, route, { authorization: 'Bearer s3cret-token' });
        expect(ok.status).toBe(200);
        expect(ok.headers['cache-control']).toBe('no-store');
      }
    } finally {
      await ts.stop();
    }
  });

  it('disabled (production, no token): 404 like any unknown route', async () => {
    const ts = await startTestServer({ NODE_ENV: 'production' });
    try {
      for (const route of routes) {
        const r = await rawGet(ts.base, route, { authorization: 'Bearer anything' });
        expect(r.status).toBe(404);
        expect(JSON.parse(r.body.toString()).code).toBe('NOT_FOUND');
        expect(r.headers['www-authenticate']).toBeUndefined();
      }
      expect((await rawGet(ts.base, '/health')).status).toBe(200);
    } finally {
      await ts.stop();
    }
  });

  it('non-production default stays public', async () => {
    const ts = await startTestServer({});
    try {
      expect((await rawGet(ts.base, '/metrics')).status).toBe(200);
    } finally {
      await ts.stop();
    }
  });
});
