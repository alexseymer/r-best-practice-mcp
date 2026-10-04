import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { AddressInfo } from 'net';
import { RPracticesWebServer } from '../../src/web-server';
import { registerUploadRoutes } from '../../src/routes/upload';
import { stripDirPrefix, UploadGate } from '../../src/engine/upload';
import { WorkflowDetector } from '../../src/engine/detector';
import { Validator } from '../../src/engine/validator';
import { UPLOAD_LIMITS } from '../../src/config/runtime';
import { createTempDir, cleanupTempDir, createFile } from '../fixtures/setup';

const tempDirs = (): string[] =>
  fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('rbp-upload-'));

interface Reply {
  status: number;
  headers: Headers;
  json: any;
}

async function post(base: string, route: string, body: unknown, raw?: string): Promise<Reply> {
  const res = await fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, json: await res.json() };
}

const PACKAGE_FILES: Record<string, string> = {
  DESCRIPTION: 'Package: demo\nVersion: 0.1.0\nTitle: Demo\n',
  NAMESPACE: 'export(add)\n',
  'R/add.R': "add <- function(a, b) {\n  a+b\n}\nsetwd('/tmp')\n",
  'man/add.Rd': '% not an allowed type\n',
};

const toUpload = (files: Record<string, string>) =>
  Object.entries(files).map(([p, content]) => ({ path: p, content }));

describe('POST /api/validate-upload (full server)', () => {
  let server: http.Server;
  let base: string;
  let realSetInterval: typeof setInterval;

  beforeAll(async () => {
    // The rate limiter starts an interval that would keep Jest alive.
    realSetInterval = global.setInterval;
    global.setInterval = ((...args: Parameters<typeof setInterval>) => {
      const t = realSetInterval(...args);
      t.unref();
      return t;
    }) as typeof setInterval;
    const web = new RPracticesWebServer(0);
    const app = (web as unknown as { app: express.Express }).app;
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    global.setInterval = realSetInterval;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns the same findings as validate-project on the same folder', async () => {
    const dir = createTempDir();
    try {
      for (const [p, c] of Object.entries(PACKAGE_FILES)) {
        if (p.endsWith('.Rd')) continue;
        createFile(dir, p, c);
      }
      const local = await post(base, '/api/validate-project', { path: dir });
      expect(local.status).toBe(200);

      const before = tempDirs();
      const up = await post(base, '/api/validate-upload', { files: toUpload(PACKAGE_FILES) });
      expect(up.status).toBe(200);
      expect(up.json.error).toBe(false);
      const data = up.json.data;
      expect(data.workflow).toBe('package');
      expect(data.filePath).toBe('uploaded project');
      expect(data.findings.length).toBeGreaterThan(0);
      // validate-project reports absolute paths; the upload reports them relative to the root
      expect(data.findings).toEqual(stripDirPrefix(local.json.data.findings, [dir]));
      expect(data.summary).toEqual(local.json.data.summary);
      expect(data.detected).toMatchObject({ workflow: 'package' });
      expect(typeof data.detected.confidence).toBe('number');
      expect(Array.isArray(data.detected.indicators)).toBe(true);
      expect(data.upload).toEqual({
        files: 3,
        bytes: Object.entries(PACKAGE_FILES)
          .filter(([p]) => !p.endsWith('.Rd'))
          .reduce((n, [, c]) => n + Buffer.byteLength(c), 0),
        skipped: 1,
      });
      expect(tempDirs()).toEqual(before);
    } finally {
      cleanupTempDir(dir);
    }
  });

  it('never reveals the temp directory, also where rules embed absolute paths', async () => {
    const res = await post(base, '/api/validate-upload', {
      workflow: 'bookdown',
      files: [
        { path: '_bookdown.yml', content: 'book_filename: "x"\n' },
        { path: 'index.Rmd', content: '---\ntitle: x\n---\n' },
        { path: 'chapter one.Rmd', content: '# One\n' },
      ],
    });
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.json);
    expect(text).not.toContain(os.tmpdir());
    expect(text).not.toContain('rbp-upload-');
    const files = res.json.data.findings.map((f: { file?: string }) => f.file).filter(Boolean);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(path.isAbsolute(f)).toBe(false);
  });

  it('applies workflow and finding filters', async () => {
    const res = await post(base, '/api/validate-upload', {
      files: toUpload(PACKAGE_FILES),
      workflow: 'r-script',
      minSeverity: 'critical',
      maxFindings: 1,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.workflow).toBe('r-script');
    expect(res.json.data.findings.length).toBeLessThanOrEqual(1);
    // detection still reflects the tree
    expect(res.json.data.detected.workflow).toBe('package');
  });

  it('detectOnly returns the detection without findings', async () => {
    const res = await post(base, '/api/validate-upload', {
      files: toUpload(PACKAGE_FILES),
      detectOnly: true,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.detected.workflow).toBe('package');
    expect(res.json.data.findings).toBeUndefined();
    expect(res.json.data.upload.files).toBe(3);
  });

  it('keeps an unknown workflow unknown', async () => {
    const res = await post(base, '/api/validate-upload', {
      files: [{ path: 'notes.txt', content: 'hello' }],
    });
    expect(res.status).toBe(200);
    expect(res.json.data.workflow).toBe('unknown');
  });

  it.each([
    ['../evil.R'],
    ['R/../../evil.R'],
    ['/etc/passwd.txt'],
    ['C:\\Windows\\a.R'],
    ['..\\evil.R'],
  ])('rejects traversal path %s without writing anything', async (p) => {
    const before = tempDirs();
    const marker = path.join(os.tmpdir(), 'evil.R');
    const res = await post(base, '/api/validate-upload', {
      files: [
        { path: 'ok.R', content: 'x <- 1' },
        { path: p, content: 'x' },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: true, code: 'INVALID_PARAMETER' });
    expect(fs.existsSync(marker)).toBe(false);
    expect(tempDirs()).toEqual(before);
  });

  it('rejects invalid filters and workflows', async () => {
    const files = toUpload(PACKAGE_FILES);
    expect((await post(base, '/api/validate-upload', { files, minSeverity: 'nope' })).status).toBe(
      400
    );
    expect((await post(base, '/api/validate-upload', { files, maxFindings: 0 })).status).toBe(400);
    const wf = await post(base, '/api/validate-upload', { files, workflow: 'cobol' });
    expect(wf.status).toBe(400);
    expect(wf.json.code).toBe('INVALID_WORKFLOW');
  });

  it('rejects missing/unsupported uploads and malformed JSON', async () => {
    expect((await post(base, '/api/validate-upload', {})).status).toBe(400);
    const none = await post(base, '/api/validate-upload', {
      files: [{ path: 'logo.png', content: 'x' }],
    });
    expect(none.status).toBe(400);
    expect(none.json.message).toMatch(/no supported files/);
  });

  it('answers oversize uploads with 413 and leaves no temp directory', async () => {
    const before = tempDirs();
    const big = await post(base, '/api/validate-upload', {
      files: [{ path: 'a.R', content: 'x'.repeat(UPLOAD_LIMITS.maxFileBytes + 1) }],
    });
    expect(big.status).toBe(413);
    expect(big.json.code).toBe('PAYLOAD_TOO_LARGE');
    const many = await post(base, '/api/validate-upload', {
      files: Array.from({ length: UPLOAD_LIMITS.maxFiles + 1 }, (_, i) => ({
        path: `f${i}.R`,
        content: '',
      })),
    });
    expect(many.status).toBe(413);
    const total = await post(base, '/api/validate-upload', {
      files: Array.from({ length: 6 }, (_, i) => ({
        path: `f${i}.R`,
        content: 'x'.repeat(UPLOAD_LIMITS.maxFileBytes),
      })),
    });
    expect(total.status).toBe(413);
    expect(tempDirs()).toEqual(before);
  });

  it('is only available via POST', async () => {
    const res = await fetch(`${base}/api/validate-upload`);
    expect(res.status).toBe(404);
  });

  it('is documented in the OpenAPI spec', async () => {
    const spec = await (await fetch(`${base}/openapi.json`)).json();
    expect(spec.paths['/api/validate-upload'].post.operationId).toBe('validateUpload');
  });
});

describe('registerUploadRoutes on its own', () => {
  let server: http.Server;
  let base: string;
  const gate = new UploadGate(1, 30, 1);

  beforeAll(async () => {
    // No global body parser here: the route must bring its own (LARGE_BODY_ROUTES).
    const app = express();
    const detector = new WorkflowDetector();
    let slow = false;
    const validator = new Validator();
    const original = validator.validateProject.bind(validator);
    validator.validateProject = (async (...args: Parameters<Validator['validateProject']>) => {
      if (slow) await new Promise((r) => setTimeout(r, 300));
      return original(...args);
    }) as Validator['validateProject'];
    (app as unknown as { setSlow: (v: boolean) => void }).setSlow = (v) => {
      slow = v;
    };
    registerUploadRoutes(app, { validator, detector, gate });
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    (globalThis as { __app?: express.Express }).__app = app;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('parses a body of several MB with its own parser', async () => {
    const files = Array.from({ length: 4 }, (_, i) => ({
      path: `r${i}.R`,
      content: 'x <- 1\n'.repeat(100_000),
    }));
    const res = await post(base, '/api/validate-upload', { files });
    expect(res.status).toBe(200);
    expect(res.json.data.upload.files).toBe(4);
  });

  it('rejects bodies above the route limit with 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await post(base, '/api/validate-upload', {
      files: [{ path: 'a.R', content: 'x'.repeat(9 * 1024 * 1024) }],
    });
    expect(res.status).toBe(413);
    expect(res.json.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('answers malformed JSON with 400 INVALID_PARAMETER', async () => {
    const bad = await post(base, '/api/validate-upload', null, '{not json');
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe('INVALID_PARAMETER');
  });

  it('answers 503 BUSY with Retry-After when the gate is saturated', async () => {
    const app = (globalThis as { __app?: express.Express & { setSlow?: (v: boolean) => void } })
      .__app!;
    app.setSlow!(true);
    try {
      const body = { files: [{ path: 'a.R', content: 'x <- 1\n' }] };
      const first = post(base, '/api/validate-upload', body);
      await new Promise((r) => setTimeout(r, 100));
      const second = await post(base, '/api/validate-upload', body);
      expect(second.status).toBe(503);
      expect(second.json.code).toBe('BUSY');
      expect(second.headers.get('retry-after')).toBeTruthy();
      expect((await first).status).toBe(200);
    } finally {
      app.setSlow!(false);
    }
    expect(gate.inFlight).toBe(0);
  });

  it('cleans up when validation throws and hides the error details', async () => {
    const before = tempDirs();
    const app = express();
    const validator = new Validator();
    validator.validateProject = (async () => {
      throw new Error('/secret/server/path exploded');
    }) as Validator['validateProject'];
    registerUploadRoutes(app, { validator, detector: new WorkflowDetector() });
    const s = await new Promise<http.Server>((resolve) => {
      const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
    });
    try {
      const b = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
      const res = await post(b, '/api/validate-upload', {
        files: [{ path: 'a.R', content: 'x <- 1\n' }],
      });
      expect(res.status).toBe(500);
      expect(JSON.stringify(res.json)).not.toContain('secret');
    } finally {
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
    expect(tempDirs()).toEqual(before);
  });
});
