import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { isStaticAssetPath } from '../../src/middleware/static-assets';
import { startTestServer, TestServer } from '../helpers/web';

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'src', 'public');
const read = (p: string): string => fs.readFileSync(path.join(PUBLIC, p), 'utf8');

describe('dashboard is self-hosted (#19)', () => {
  const pages = ['dashboard.html', 'api-docs.html'];

  it.each(pages)('%s references no third-party origin', (page) => {
    const html = read(page);
    // anything the browser fetches: <link>, <script>, <img>, <source>, <iframe> (plain <a> links are not fetches)
    const fetched = [
      ...html.matchAll(
        /<(?:link|script|img|source|iframe)\b[^>]*\b(?:src|href)\s*=\s*"(https?:[^"]*)"/gi
      ),
    ].map((m) => m[1]);
    expect(fetched).toEqual([]);
    expect(html).not.toMatch(/cdn\.|googleapis|gstatic|jsdelivr|unpkg/);
  });

  it.each(pages)('%s has no inline script, style element or style attribute', (page) => {
    const html = read(page);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
    expect(html).not.toMatch(/<style[\s>]/i);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('dashboard.js never writes inline style attributes or markup', () => {
    const js = read('dashboard.js');
    expect(js).not.toMatch(/setAttribute\(\s*['"]style['"]/);
    expect(js).not.toMatch(/\.innerHTML\s*=/);
    expect(js).not.toMatch(/material-symbols/);
  });

  it('every icon the dashboard uses exists in the committed sprite', () => {
    const sprite = read('icons.svg');
    const ids = new Set([...sprite.matchAll(/<symbol id="([a-z_]+)"/g)].map((m) => m[1]));
    const used = new Set<string>();
    for (const m of read('dashboard.html').matchAll(/\/icons\.svg#([a-z_]+)/g)) used.add(m[1]);
    for (const m of read('dashboard.js').matchAll(/icon\(\s*'([a-z_]+)'/g)) used.add(m[1]);
    for (const m of read('dashboard.js').matchAll(
      /icon\([^)]*\?\s*'([a-z_]+)'\s*:\s*'([a-z_]+)'/g
    )) {
      used.add(m[1]);
      used.add(m[2]);
    }
    expect(used.size).toBeGreaterThanOrEqual(14);
    expect([...used].filter((u) => !ids.has(u))).toEqual([]);
    expect(sprite).not.toMatch(/<(script|style|image|foreignObject)\b|\sstyle=|href="http/i);
  });

  it('ships the self-hosted fonts with their OFL licenses', () => {
    const fonts = fs.readdirSync(path.join(PUBLIC, 'fonts'));
    expect(fonts.filter((f) => f.endsWith('.woff2')).length).toBe(8);
    const css = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'dashboard.css'), 'utf8');
    for (const m of css.matchAll(/url\('\/fonts\/([^']+)'\)/g)) expect(fonts).toContain(m[1]);
    for (const f of ['LICENSE-Geist-OFL.txt', 'LICENSE-JetBrainsMono-OFL.txt']) {
      expect(fs.readFileSync(path.join(PUBLIC, 'fonts', f), 'utf8')).toMatch(
        /SIL OPEN FONT LICENSE/i
      );
    }
    expect(css).not.toMatch(/https?:/);
  });

  it('pins the front-end build tools and Swagger UI exactly', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of [
      'tailwindcss',
      '@tailwindcss/forms',
      '@tailwindcss/container-queries',
      '@fontsource/geist',
      '@fontsource/jetbrains-mono',
      '@material-design-icons/svg',
      'swagger-ui-dist',
    ]) {
      expect(all[name]).toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(pkg.dependencies['swagger-ui-dist']).toBeDefined(); // served at runtime
    expect(pkg.scripts.build).toContain('build:css');
    expect(fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8')).toContain('tailwind.config.cjs');
    expect(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8')).toContain(
      'src/public/dashboard.css'
    );
  });
});

describe('isStaticAssetPath', () => {
  it('matches only the fixed front-end files for GET/HEAD', () => {
    for (const p of [
      '/dashboard.css',
      '/dashboard.js',
      '/icons.svg',
      '/fonts/geist-latin-400-normal.woff2',
      '/api-docs/assets/swagger-ui.css',
    ]) {
      expect(isStaticAssetPath('GET', p)).toBe(true);
      expect(isStaticAssetPath('HEAD', p)).toBe(true);
      expect(isStaticAssetPath('POST', p)).toBe(false);
    }
    for (const p of [
      '/dashboard',
      '/api-docs',
      '/api/tools',
      '/health',
      '/fonts',
      '/fonts/../etc',
    ]) {
      expect(isStaticAssetPath('GET', p)).toBe(false);
    }
  });
});

describe('self-hosted assets over HTTP', () => {
  let ts: TestServer;
  beforeAll(async () => {
    if (!fs.existsSync(path.join(PUBLIC, 'dashboard.css'))) {
      execSync('npm run build:css', { cwd: ROOT, stdio: 'ignore' });
    }
    ts = await startTestServer({}, { rateLimit: { windowMs: 60000, maxRequests: 3 } });
  });
  afterAll(async () => {
    await ts.stop();
  });

  it('serves the compiled stylesheet with the theme tokens, fonts and sprite', async () => {
    const css = await fetch(ts.base + '/dashboard.css');
    expect(css.status).toBe(200);
    expect(css.headers.get('content-type')).toMatch(/text\/css/);
    const text = await css.text();
    expect(text).toContain('.bg-surface-canvas');
    expect(text).toContain('.font-body-md');
    expect(text).toMatch(/font-face/);
    expect(text).not.toMatch(/url\(\s*['"]?https?:|@import/);

    const font = await fetch(ts.base + '/fonts/geist-latin-400-normal.woff2');
    expect(font.status).toBe(200);
    expect(font.headers.get('content-type')).toMatch(/font\/woff2/);
    const sprite = await fetch(ts.base + '/icons.svg');
    expect(sprite.status).toBe(200);
    expect(sprite.headers.get('content-type')).toMatch(/image\/svg\+xml/);
  });

  it('serves Swagger UI locally from the pinned package on /api-docs', async () => {
    const page = await (await fetch(ts.base + '/api-docs')).text();
    expect(page).toContain('/api-docs/assets/swagger-ui-bundle.js');
    expect(page).not.toMatch(/https?:\/\/cdn|jsdelivr/);
    const bundle = await fetch(ts.base + '/api-docs/assets/swagger-ui-bundle.js');
    expect(bundle.status).toBe(200);
    expect(bundle.headers.get('content-type')).toMatch(/javascript/);
    expect((await bundle.text()).length).toBeGreaterThan(100000);
    const css = await fetch(ts.base + '/api-docs/assets/swagger-ui.css');
    expect(css.status).toBe(200);
    // only the two files the page needs are exposed, not the whole package
    for (const f of ['package.json', 'swagger-ui-bundle.js.map', 'index.html']) {
      const r = await fetch(ts.base + '/api-docs/assets/' + f);
      expect(r.status).toBe(404);
    }
  });

  it('does not count static assets against the rate limit (limit is 3 here)', async () => {
    for (let i = 0; i < 8; i++) {
      const r = await fetch(ts.base + '/icons.svg');
      await r.arrayBuffer();
      expect(r.status).toBe(200);
    }
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await fetch(ts.base + '/api/tools');
      await r.arrayBuffer();
      statuses.push(r.status);
    }
    expect(statuses).toContain(429);
  });
});
