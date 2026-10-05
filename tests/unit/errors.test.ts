import { classifyError } from '../../src/middleware/errors';
import { startTestServer, postJson, TestServer } from '../helpers/web';

describe('classifyError', () => {
  it('maps body-parser parse failures to 400 INVALID_JSON', () => {
    const r = classifyError(
      Object.assign(new SyntaxError('boom'), { type: 'entity.parse.failed', status: 400 })
    );
    expect(r.status).toBe(400);
    expect(r.body).toEqual({
      error: true,
      code: 'INVALID_JSON',
      message: 'Request body is not valid JSON',
    });
  });

  it('maps oversized bodies to 413 PAYLOAD_TOO_LARGE', () => {
    const r = classifyError({ type: 'entity.too.large', status: 413 });
    expect(r.status).toBe(413);
    expect(r.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('keeps other 4xx statuses with code BAD_REQUEST', () => {
    const r = classifyError({ status: 415, message: 'unsupported /secret/path' });
    expect(r.status).toBe(415);
    expect(r.body.code).toBe('BAD_REQUEST');
    expect(JSON.stringify(r.body)).not.toContain('/secret/path');
  });

  it('maps everything else to 500 INTERNAL_ERROR without leaking details', () => {
    const errors = [
      new Error('ENOENT /etc/shadow'),
      'str',
      null,
      undefined,
      { status: 503 },
      { status: 99 },
    ];
    for (const err of errors) {
      const r = classifyError(err);
      expect(r.status).toBe(500);
      expect(r.body).toEqual({
        error: true,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    }
  });
});

describe('error handling over HTTP', () => {
  let ts: TestServer;
  beforeAll(async () => {
    ts = await startTestServer();
  });
  afterAll(async () => {
    await ts.stop();
  });

  it('returns 400 INVALID_JSON for malformed JSON on POST routes', async () => {
    const routes = [
      '/api/detect-workflow',
      '/api/v1/validate-project',
      '/api/validate-file',
      '/api/generate-template',
    ];
    for (const route of routes) {
      const r = await postJson(ts.base, route, '{"path": ');
      expect(r.status).toBe(400);
      expect(r.body).toEqual({
        error: true,
        code: 'INVALID_JSON',
        message: 'Request body is not valid JSON',
      });
    }
  });

  it('does not leak parser details', async () => {
    const r = await postJson(ts.base, '/api/detect-workflow', '{bad');
    expect(JSON.stringify(r.body)).not.toMatch(/Unexpected|position|node_modules/);
  });

  it('still returns 404 JSON for unknown routes', async () => {
    const res = await fetch(ts.base + '/nope');
    expect(res.status).toBe(404);
  });
});
