#!/usr/bin/env node
/**
 * Acceptance checks for a running deployment. Run after every deploy:
 *
 *   LIVE_BASE_URL=https://example.org node scripts/live-acceptance.mjs
 *
 * Checks what a visitor and an API client rely on: health, configuration, the dashboard's security
 * headers, the browser engine, the API, error shapes, rate-limit headers and metrics protection. Each
 * expectation follows what the deployment reports in /api/config, so the same script works for a
 * local development server and for production. Exits 1 if any check fails. Makes about 25 requests,
 * well under the per-IP limit of 100 per minute.
 */

const base = (process.env.LIVE_BASE_URL || '').replace(/\/+$/, '');
if (!base) {
  console.error('Set LIVE_BASE_URL, for example LIVE_BASE_URL=http://localhost:3000');
  process.exit(2);
}

const results = [];
const record = (area, name, status, detail = '') => {
  results.push({ area, name, status });
  const line = `${status.padEnd(4)} [${area}] ${name}${detail ? ` -- ${detail}` : ''}`;
  console.log(line);
};
const check = (area, name, ok, detail) => record(area, name, ok ? 'PASS' : 'FAIL', ok ? '' : detail);
const warn = (area, name, detail) => record(area, name, 'WARN', detail);

async function call(method, path, { body, raw, headers = {} } = {}) {
  // redirect: 'manual' so a 301 is reported as the server sends it, not as its target
  const init = { method, headers: { ...headers }, redirect: 'manual' };
  if (raw !== undefined) {
    init.body = raw;
    init.headers['Content-Type'] = 'application/json';
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(base + path, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, text, json };
}

async function run() {
  // 1. Health and configuration (everything else adapts to these)
  const health = await call('GET', '/health');
  check('health', '/health answers ok', health.status === 200 && health.json?.status === 'ok', `HTTP ${health.status}`);
  if (health.json?.build?.commit) {
    check('health', 'build commit is reported', true);
  } else {
    warn('health', 'build commit is reported', 'null: deploy without GIT_SHA/BUILD_TIME (see issue #43)');
  }

  const config = await call('GET', '/api/config');
  const cfg = config.json?.data;
  check('health', '/api/config answers', config.status === 200 && !!cfg, `HTTP ${config.status}`);
  if (!cfg) {
    console.log('Cannot continue without /api/config');
    return summarise();
  }
  check('health', 'upload limits are published', cfg.upload?.maxFiles > 0 && cfg.upload?.maxFileBytes > 0);
  const restricted = cfg.serverPaths?.unrestricted === false;
  const metricsPublic = cfg.metrics?.public === true;
  const metricsToken = cfg.metrics?.tokenRequired === true;

  // 2. Dashboard and its security headers
  const dash = await call('GET', '/dashboard');
  const csp = dash.headers.get('content-security-policy') || '';
  check('dashboard', '/dashboard answers', dash.status === 200, `HTTP ${dash.status}`);
  check('dashboard', 'CSP allows only this origin for scripts, styles and fonts',
    /default-src 'self'/.test(csp) && /script-src 'self'/.test(csp) && !/unsafe-/.test(csp), csp);
  check('dashboard', 'X-Content-Type-Options is nosniff', dash.headers.get('x-content-type-options') === 'nosniff');
  check('dashboard', 'X-Frame-Options is DENY', dash.headers.get('x-frame-options') === 'DENY');
  const engine = await call('GET', '/browser-engine/engine/browser-upload.js');
  check('dashboard', 'the browser upload engine is served as JavaScript',
    engine.status === 200 && /javascript/.test(engine.headers.get('content-type') || ''), `HTTP ${engine.status}`);
  const docs = await call('GET', '/api-docs');
  check('dashboard', '/api-docs answers', docs.status === 200, `HTTP ${docs.status}`);
  const favicon = await call('GET', '/favicon.ico');
  check('dashboard', '/favicon.ico redirects to the SVG icon', favicon.status === 301, `HTTP ${favicon.status}`);

  // 3. API: practices, pagination and rate-limit headers
  const practices = await call('GET', '/api/v1/practices?limit=5');
  check('api', '/api/v1/practices is paginated', practices.status === 200 &&
    Array.isArray(practices.json?.data) && practices.json.data.length === 5 && practices.json?.pagination?.total === 70,
    JSON.stringify(practices.json?.pagination ?? practices.json).slice(0, 160));
  check('api', 'rate-limit headers are sent', !!practices.headers.get('x-ratelimit-limit'));
  check('api', 'the OpenAPI document is served', (await call('GET', '/openapi.json')).status === 200);
  const unknown = await call('GET', '/api/no-such-route');
  check('api', 'an unknown route returns a JSON 404', unknown.status === 404 && unknown.json?.error === true,
    `HTTP ${unknown.status}`);

  // 4. Uploads: analysed by the server route for API clients
  const upload = await call('POST', '/api/validate-upload', {
    body: { files: [{ path: 'DESCRIPTION', content: 'Package: demo\nVersion: 0.1.0\n' }, { path: 'R/a.R', content: 'a <- 1\n' }] },
  });
  check('upload', 'POST /api/validate-upload analyses a small package', upload.status === 200 &&
    upload.json?.data?.detected?.workflow === 'package' && Array.isArray(upload.json?.data?.findings),
    `HTTP ${upload.status} ${upload.text.slice(0, 120)}`);
  check('upload', 'upload responses never reveal the server directory',
    !/rbp-upload-|\/tmp\//.test(upload.text), 'a temp path leaked');
  const badJson = await call('POST', '/api/validate-upload', { raw: '{not json' });
  check('upload', 'malformed JSON is rejected with INVALID_JSON (SPEC §6)', badJson.status === 400 &&
    badJson.json?.code === 'INVALID_JSON', `HTTP ${badJson.status} ${badJson.text.slice(0, 100)}`);
  const traversal = await call('POST', '/api/validate-upload', {
    body: { files: [{ path: '../escape.R', content: 'x' }] },
  });
  check('upload', 'a traversal path is rejected', traversal.status === 400, `HTTP ${traversal.status}`);

  // 5. Path confinement (only meaningful when server paths are restricted)
  const outside = await call('POST', '/api/v1/validate-project', { body: { path: '/etc' } });
  if (restricted) {
    check('security', 'a server path outside the roots is refused without detail',
      outside.status === 400 && outside.json?.code === 'PATH_NOT_ALLOWED' && !/etc|ENOENT|EACCES/.test(outside.text),
      `HTTP ${outside.status}`);
  } else {
    warn('security', 'server path confinement', 'unrestricted server paths (ALLOW_ANY_PATH): not production-like');
  }

  // 6. Metrics protection, as configured
  const metrics = await call('GET', '/metrics');
  if (metricsPublic) {
    check('security', '/metrics is served (public by configuration)', metrics.status === 200, `HTTP ${metrics.status}`);
  } else if (metricsToken) {
    check('security', '/metrics requires a token', metrics.status === 401, `HTTP ${metrics.status}`);
  } else {
    check('security', '/metrics is disabled', metrics.status === 404, `HTTP ${metrics.status}`);
  }

  return summarise();
}

function summarise() {
  const failed = results.filter((r) => r.status === 'FAIL');
  const warned = results.filter((r) => r.status === 'WARN');
  const passed = results.filter((r) => r.status === 'PASS');
  console.log(`\n${passed.length} passed, ${warned.length} warnings, ${failed.length} failed (${base})`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((err) => {
  console.error('Acceptance run crashed:', err);
  process.exit(1);
});
