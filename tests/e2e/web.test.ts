/**
 * The page and its read-only endpoints, served by the real HTTP server.
 */
import zlib from 'zlib';
import { AddressInfo } from 'net';
import { createHttpServer } from '../../src/http-server';
import { createWebRoutes } from '../../src/web/routes';
import { INDEX_HTML } from '../../src/web/index-html';
import { APP_CSS } from '../../src/web/app-css';
import { APP_JS } from '../../src/web/app-js';

async function start() {
  const options = {
    version: '9.9.9',
    build: { commit: 'abc1234def', builtAt: '2026-11-23T10:00:00Z' },
    rateLimitPerMinute: 60,
    maxBodyBytes: 2_000_000,
    localPackage: 'github:example/pkg',
  };
  const server = createHttpServer({ ...options, routes: [createWebRoutes(options)] });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

describe('web page', () => {
  let app: Awaited<ReturnType<typeof start>>;
  beforeAll(async () => {
    app = await start();
  });
  afterAll(() => app.close());

  describe('page and assets', () => {
    it('serves the page with the three sections and its script and stylesheet', async () => {
      const res = await fetch(`${app.url}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
      const html = await res.text();
      for (const id of ['tab-practices', 'tab-system', 'tab-setup', 'panel-practices', 'panel-system', 'panel-setup']) {
        expect(html).toContain(`id="${id}"`);
      }
      expect(html).toContain('<script src="/app.js" defer></script>');
      expect(html).toContain('href="/app.css"');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('name="viewport"');
    });

    it('works with a Content-Security-Policy of self only: no inline script, style attribute or style element', () => {
      expect(INDEX_HTML).not.toMatch(/<script(?![^>]*\bsrc=)/i);
      expect(INDEX_HTML).not.toMatch(/\sstyle\s*=/i);
      expect(INDEX_HTML).not.toMatch(/<style/i);
      expect(INDEX_HTML).not.toMatch(/\son[a-z]+\s*=/i);
    });

    it('sends the security headers, including the CSP, on the page', async () => {
      const res = await fetch(`${app.url}/`);
      expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it.each([
      ['/app.css', 'text/css; charset=utf-8'],
      ['/app.js', 'text/javascript; charset=utf-8'],
      ['/favicon.svg', 'image/svg+xml'],
    ])('serves %s with the right content type', async (path, type) => {
      const res = await fetch(`${app.url}${path}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe(type);
    });

    it('serves gzip when the client accepts it and the same bytes after decompression', async () => {
      const plain = await (await fetch(`${app.url}/app.js`, { headers: { 'Accept-Encoding': 'identity' } })).text();
      expect(plain).toBe(APP_JS);
      const res = await fetch(`${app.url}/app.js`, { headers: { 'Accept-Encoding': 'gzip' } });
      expect(res.headers.get('vary')).toContain('Accept-Encoding');
      // fetch decompresses transparently; the content must still be identical
      expect(await res.text()).toBe(APP_JS);
    });

    it('sends Content-Encoding gzip on the wire', async () => {
      const http = await import('http');
      const body = await new Promise<{ encoding: string | undefined; text: string }>((resolve, reject) => {
        http.get(`${app.url}/app.css`, { headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            resolve({
              encoding: res.headers['content-encoding'],
              text: zlib.gunzipSync(Buffer.concat(chunks)).toString('utf8'),
            })
          );
        }).on('error', reject);
      });
      expect(body.encoding).toBe('gzip');
      expect(body.text).toBe(APP_CSS);
    });

    it('answers a matching If-None-Match with 304 and no body', async () => {
      const first = await fetch(`${app.url}/app.css`);
      const etag = first.headers.get('etag');
      expect(etag).toMatch(/^"[0-9a-f]+"$/);
      const second = await fetch(`${app.url}/app.css`, { headers: { 'If-None-Match': etag! } });
      expect(second.status).toBe(304);
      expect(await second.text()).toBe('');
    });

    it('answers HEAD without a body', async () => {
      const res = await fetch(`${app.url}/`, { method: 'HEAD' });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('');
    });

    it('redirects /dashboard to the page', async () => {
      const res = await fetch(`${app.url}/dashboard`, { redirect: 'manual' });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/');
    });

    it('refuses writes to the page and the API with 405', async () => {
      for (const path of ['/', '/api/practices', '/api/system']) {
        const res = await fetch(`${app.url}${path}`, { method: 'POST', body: '{}' });
        expect(res.status).toBe(405);
        expect(res.headers.get('allow')).toBe('GET, HEAD');
      }
    });

    it('still answers 404 for other paths', async () => {
      expect((await fetch(`${app.url}/api/other`)).status).toBe(404);
      expect((await fetch(`${app.url}/etc/passwd`)).status).toBe(404);
    });
  });

  describe('/api/practices', () => {
    it('lists all practices with the fields the page shows', async () => {
      const res = await fetch(`${app.url}/api/practices`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.count).toBe(73);
      expect(body.practices).toHaveLength(73);
      const sample = body.practices.find((p: any) => p.id === 'pkg-license');
      expect(sample).toMatchObject({
        id: 'pkg-license',
        workflow: 'package',
        severity: 'critical',
        enforcement: 'automated',
      });
      for (const p of body.practices) {
        expect(typeof p.title).toBe('string');
        expect(typeof p.description).toBe('string');
        for (const ref of p.references ?? []) expect(ref).toMatch(/^https:\/\//);
      }
    });
  });

  describe('/api/system', () => {
    it('reports status, version, build, counts, tools, limits and the local install', async () => {
      const body = await (await fetch(`${app.url}/api/system`)).json();
      expect(body).toMatchObject({
        status: 'ok',
        version: '9.9.9',
        mode: 'remote',
        build: { commit: 'abc1234def', builtAt: '2026-11-23T10:00:00Z' },
        practices: { total: 73, automated: 62, guidance: 11 },
        endpoints: { mcp: '/mcp', health: '/health' },
        localInstall: { package: 'github:example/pkg', bin: 'r-best-practices-mcp' },
        limits: { rateLimitPerMinute: 60, maxFiles: 300, maxFileBytes: 200000, maxTotalBytes: 1000000 },
      });
      expect(body.practices.workflows).toHaveLength(12);
      expect(body.tools.map((t: any) => t.name).sort()).toEqual(['check_files', 'create_project', 'get_practice']);
      expect(typeof body.uptimeSeconds).toBe('number');
    });

    it('is not cached', async () => {
      const res = await fetch(`${app.url}/api/system`);
      expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('exposes nothing about the host: no paths, environment or addresses', async () => {
      const text = await (await fetch(`${app.url}/api/system`)).text();
      expect(text).not.toMatch(/\/home\/|\/Users\/|process\.env|127\.0\.0\.1|PASSWORD|TOKEN|SECRET/i);
    });
  });

  describe('page script guards', () => {
    it('is valid JavaScript', () => {
      expect(() => new Function(APP_JS)).not.toThrow();
    });

    it('never builds HTML from data: only textContent and DOM nodes', () => {
      expect(APP_JS).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/);
    });

    it('only links to https references from practice data', () => {
      expect(APP_JS).toContain("indexOf('https://') === 0");
    });

    it('opens external links with rel=noopener', () => {
      const links = APP_JS.match(/target: '_blank'/g) ?? [];
      const noopener = APP_JS.match(/rel: 'noopener', target: '_blank'/g) ?? [];
      expect(links.length).toBeGreaterThan(0);
      expect(noopener.length).toBe(links.length);
    });

    it('uses no external hosts, so the CSP of self only is enough', () => {
      for (const source of [INDEX_HTML, APP_CSS]) {
        expect(source).not.toMatch(/(src|href)=["']https?:\/\/(?!github\.com\/alexseymer)/i);
        expect(source).not.toMatch(/@import|url\(\s*["']?https?:/i);
      }
    });
  });
});
