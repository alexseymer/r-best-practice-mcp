/**
 * The hosted server end to end: a real HTTP server on a free port, MCP over POST /mcp.
 */
import fs from 'fs';
import path from 'path';
import { AddressInfo } from 'net';
import { createHttpServer, HttpServerOptions } from '../../src/http-server';

const EXAMPLE_PACKAGE = path.resolve(__dirname, '../fixtures/examples/example-package');

type Json = Record<string, any>;

function readTree(dir: string, prefix = ''): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...readTree(path.join(dir, entry.name), rel));
    else out.push({ path: rel, content: fs.readFileSync(path.join(dir, entry.name), 'utf8') });
  }
  return out;
}

async function start(options: Partial<HttpServerOptions> = {}) {
  const server = createHttpServer({ version: '9.9.9', ...options });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${url}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  let id = 1;
  const rpc = async (method: string, params: Json = {}, headers: Record<string, string> = {}): Promise<Json> =>
    (await post({ jsonrpc: '2.0', id: id++, method, params }, headers)).json();

  const tool = async (name: string, args: Json, headers: Record<string, string> = {}): Promise<Json> => {
    const res = await rpc('tools/call', { name, arguments: args }, headers);
    return JSON.parse(res.result.content[0].text);
  };

  const close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    });

  return { url, post, rpc, tool, close };
}

describe('hosted HTTP server', () => {
  let app: Awaited<ReturnType<typeof start>>;

  beforeAll(async () => {
    app = await start({ build: { commit: 'abc1234', builtAt: '2026-11-23T10:00:00Z' } });
  });
  afterAll(() => app.close());

  describe('health and routing', () => {
    it('reports status, version and build', async () => {
      const res = await fetch(`${app.url}/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        status: 'ok',
        version: '9.9.9',
        mode: 'remote',
        build: { commit: 'abc1234', builtAt: '2026-11-23T10:00:00Z' },
      });
      expect(typeof body.uptimeSeconds).toBe('number');
    });

    it('sends security headers', async () => {
      const res = await fetch(`${app.url}/health`);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    });

    it('answers an unknown path with 404', async () => {
      expect((await fetch(`${app.url}/nope`)).status).toBe(404);
    });

    it.each(['GET', 'DELETE', 'PUT'])('refuses %s /mcp with 405 and an Allow header', async (method) => {
      const res = await fetch(`${app.url}/mcp`, { method });
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('POST');
    });
  });

  describe('MCP over HTTP', () => {
    it('answers initialize', async () => {
      const res = await app.rpc('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'http-test', version: '0' },
      });
      expect(res.result.serverInfo.name).toBe('r-best-practices-mcp');
      expect(Object.keys(res.result.capabilities).sort()).toEqual(['prompts', 'resources', 'tools']);
    });

    it('offers check_files, get_practice and create_project, but not check_project', async () => {
      const res = await app.rpc('tools/list');
      expect(res.result.tools.map((t: Json) => t.name).sort()).toEqual([
        'check_files',
        'create_project',
        'get_practice',
      ]);
    });

    it('does not let a client call check_project by guessing the name', async () => {
      const result = await app.tool('check_project', { path: '/etc' });
      expect(result.code).toBe('UNKNOWN_TOOL');
    });

    it('lists prompts and 74 resources and reads one', async () => {
      expect((await app.rpc('prompts/list')).result.prompts).toHaveLength(4);
      expect((await app.rpc('resources/list')).result.resources).toHaveLength(74);
      const read = await app.rpc('resources/read', { uri: 'practice://pkg-readme' });
      expect(read.result.contents[0].text).toMatch(/^# /);
    });

    it('answers a malformed JSON-RPC request with an error, not a crash', async () => {
      const res = await app.post({ not: 'jsonrpc' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect((await fetch(`${app.url}/health`)).status).toBe(200);
    });
  });

  describe('check_files', () => {
    it('detects and checks a project sent as text', async () => {
      const result = await app.tool('check_files', { files: readTree(EXAMPLE_PACKAGE) });
      expect(result.error).toBe(false);
      expect(result.data.detection.workflow).toBe('package');
      expect(Array.isArray(result.data.findings)).toBe(true);
      expect(result.data.summary).toBeDefined();
    });

    it('reports findings with project-relative paths', async () => {
      const result = await app.tool('check_files', {
        files: [
          { path: 'DESCRIPTION', content: 'Package: demo\nVersion: 0.1.0\nTitle: Demo.\nDescription: A demo\nLicense: MIT\nAuthors@R: person("A", "B", role = c("aut", "cre"))\n' },
          { path: 'R/a.R', content: 'f <- function() 1\n' },
        ],
      });
      expect(result.error).toBe(false);
      for (const finding of result.data.findings) {
        if (finding.file) expect(finding.file.startsWith('/')).toBe(false);
      }
      expect(result.data.filePath).toBeUndefined();
    });

    it('finds a deliberate problem', async () => {
      const result = await app.tool('check_files', {
        files: [{ path: 'DESCRIPTION', content: 'Package: demo\n' }],
        workflow: 'package',
      });
      expect(result.data.findings.map((f: Json) => f.id)).toContain('pkg-description');
    });

    it('honours minSeverity', async () => {
      const result = await app.tool('check_files', {
        files: [{ path: 'DESCRIPTION', content: 'Package: demo\n' }],
        workflow: 'package',
        minSeverity: 'critical',
      });
      expect(result.data.findings.every((f: Json) => f.severity === 'critical')).toBe(true);
    });

    it.each([
      ['an absolute path', '/etc/passwd'],
      ['a parent path', '../../etc/passwd'],
      ['a backslash path', 'R\\a.R'],
    ])('rejects %s', async (_label, p) => {
      const result = await app.tool('check_files', { files: [{ path: p, content: 'x' }] });
      expect(result.code).toBe('INVALID_PARAMETER');
    });

    it('rejects a missing files argument and an unknown project type', async () => {
      expect((await app.tool('check_files', {})).code).toBe('INVALID_PARAMETER');
      expect(
        (await app.tool('check_files', { files: [{ path: 'a.R', content: 'x' }], workflow: 'python' })).code
      ).toBe('INVALID_PARAMETER');
    });

    it('rejects a project over the size limit', async () => {
      const result = await app.tool('check_files', {
        files: [{ path: 'a.R', content: 'x'.repeat(250_000) }],
      });
      expect(result.code).toBe('INVALID_PARAMETER');
    });

    it('does not read the server disk: an existing server path is just text without files', async () => {
      const result = await app.tool('check_files', { files: [{ path: 'etc/hostname', content: 'x' }] });
      expect(result.error).toBe(false);
      expect(result.data.detection.workflow).toBe('unknown');
    });

    it('never writes file contents to the logs', async () => {
      const secret = 'SECRET-TOKEN-should-not-be-logged-12345';
      const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        await app.tool('check_files', { files: [{ path: 'R/a.R', content: `key <- "${secret}"\n` }] });
        // JSON.stringify, not String(): objects passed to the logger must not hide their contents from this check
        const logged = spy.mock.calls.map((call) => JSON.stringify(call)).join('\n');
        expect(logged).not.toContain(secret);
        expect(logged).toContain('check_files');
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('create_project and get_practice', () => {
    it('creates a project', async () => {
      const result = await app.tool('create_project', { type: 'package', projectName: 'hostedpkg' });
      expect(result.error).toBe(false);
      expect(result.data.files.some((f: Json) => f.path === 'DESCRIPTION')).toBe(true);
    });

    it('asks for the name in the chat, even if the client offers elicitation', async () => {
      await app.rpc('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: { elicitation: {} },
        clientInfo: { name: 'http-test', version: '0' },
      });
      const result = await app.tool('create_project', { type: 'shiny' });
      expect(result.code).toBe('NEEDS_INPUT');
    });

    it('returns a practice', async () => {
      const result = await app.tool('get_practice', { id: 'pkg-readme' });
      expect(result.data.id).toBe('pkg-readme');
    });
  });
});

describe('hosted HTTP server: limits and guards', () => {
  it('refuses a body over the limit with 413', async () => {
    const app = await start({ maxBodyBytes: 500 });
    try {
      const res = await app.post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'x', params: { pad: 'x'.repeat(2000) } }));
      expect(res.status).toBe(413);
    } finally {
      await app.close();
    }
  });

  it('answers invalid JSON with 400 and a parse error', async () => {
    const app = await start();
    try {
      const res = await app.post('{not json');
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe(-32700);
    } finally {
      await app.close();
    }
  });

  it('limits requests per client with 429 and Retry-After, but not /health', async () => {
    const app = await start({ rateLimitPerMinute: 3 });
    try {
      for (let i = 0; i < 3; i++) expect((await app.post({ jsonrpc: '2.0', id: i, method: 'tools/list' })).status).toBe(200);
      const blocked = await app.post({ jsonrpc: '2.0', id: 9, method: 'tools/list' });
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
      expect((await fetch(`${app.url}/health`)).status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('ignores X-Forwarded-For unless a proxy is trusted, so it cannot be used to dodge the limit', async () => {
    const app = await start({ rateLimitPerMinute: 1 });
    try {
      const call = (ip: string) => app.post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { 'X-Forwarded-For': ip });
      expect((await call('1.1.1.1')).status).toBe(200);
      expect((await call('2.2.2.2')).status).toBe(429);
    } finally {
      await app.close();
    }
  });

  it('counts clients separately by the proxy-added address when one proxy is trusted', async () => {
    const app = await start({ rateLimitPerMinute: 1, trustProxyHops: 1 });
    try {
      const call = (ip: string) => app.post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { 'X-Forwarded-For': ip });
      expect((await call('1.1.1.1')).status).toBe(200);
      expect((await call('2.2.2.2')).status).toBe(200);
      expect((await call('1.1.1.1')).status).toBe(429);
      // a client-supplied entry in front of the proxy's entry does not change the key
      expect((await call('9.9.9.9, 1.1.1.1')).status).toBe(429);
    } finally {
      await app.close();
    }
  });

  it('turns the rate limit off with 0', async () => {
    const app = await start({ rateLimitPerMinute: 0 });
    try {
      for (let i = 0; i < 20; i++) expect((await app.post({ jsonrpc: '2.0', id: i, method: 'tools/list' })).status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('refuses a browser request from a foreign origin, accepts the own and listed origins', async () => {
    const app = await start({ allowedOrigins: ['https://app.example'] });
    try {
      const call = (origin: string) =>
        app.post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { Origin: origin });
      expect((await call('https://evil.example')).status).toBe(403);
      expect((await call('not a url')).status).toBe(403);
      expect((await call('https://app.example')).status).toBe(200);
      expect((await call(app.url)).status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('serves extra routes before answering 404', async () => {
    const app = await start({
      routes: [
        (req, res, url) => {
          if (url.pathname !== '/hello') return false;
          res.end('hi');
          return true;
        },
      ],
    });
    try {
      expect(await (await fetch(`${app.url}/hello`)).text()).toBe('hi');
      expect((await fetch(`${app.url}/other`)).status).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('turns away requests above the concurrency limit with 503', async () => {
    const app = await start({ maxConcurrent: 1 });
    try {
      // The first request keeps the slot open while its body is still arriving.
      const slow = await new Promise<import('http').ClientRequest>((resolve) => {
        const http = require('http');
        const req = http.request(`${app.url}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        });
        req.on('error', () => undefined);
        req.write('{"jsonrpc":"2.0",');
        setTimeout(() => resolve(req), 100);
      });
      const busy = await app.post({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
      expect(busy.status).toBe(503);
      expect(busy.headers.get('retry-after')).toBe('1');
      slow.destroy();
    } finally {
      await app.close();
    }
  });
});
