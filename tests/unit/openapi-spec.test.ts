import { OpenAPIGenerator } from '../../src/utils/openapi';
import { getRuntimeConfig } from '../../src/config/runtime';
import { startTestServer, TestServer } from '../helpers/web';

type Json = Record<string, any>;

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

/** Hand-written structural check of the OpenAPI 3.0 fields this project relies on. */
function validateOpenApi(spec: Json): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);

  if (typeof spec.openapi !== 'string' || !/^3\.0\.\d+$/.test(spec.openapi))
    err('openapi must be 3.0.x');
  if (!spec.info || typeof spec.info.title !== 'string' || !spec.info.title) err('info.title');
  if (!spec.info || typeof spec.info.version !== 'string' || !spec.info.version)
    err('info.version');
  if (!spec.paths || typeof spec.paths !== 'object' || Object.keys(spec.paths).length === 0) {
    err('paths must be a non-empty object');
  }
  for (const s of spec.servers ?? []) if (typeof s.url !== 'string') err('servers[].url');

  const operationIds = new Set<string>();
  for (const [p, item] of Object.entries<Json>(spec.paths ?? {})) {
    if (!p.startsWith('/')) err(`path ${p} must start with /`);
    const templated = [...p.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const ops = Object.entries(item).filter(([k]) => HTTP_METHODS.includes(k));
    if (ops.length === 0) err(`${p}: no operations`);
    for (const [method, op] of ops as Array<[string, Json]>) {
      const where = `${method.toUpperCase()} ${p}`;
      if (!op.responses || Object.keys(op.responses).length === 0) err(`${where}: responses`);
      for (const [code, r] of Object.entries<Json>(op.responses ?? {})) {
        if (!/^([1-5]\d\d|default)$/.test(code)) err(`${where}: bad status ${code}`);
        if (!r.$ref && typeof r.description !== 'string')
          err(`${where}: response ${code} description`);
      }
      if (op.operationId !== undefined) {
        if (operationIds.has(op.operationId))
          err(`${where}: duplicate operationId ${op.operationId}`);
        operationIds.add(op.operationId);
      }
      const paramNames = new Set<string>();
      for (const prm of op.parameters ?? []) {
        if (prm.$ref) continue;
        if (typeof prm.name !== 'string') err(`${where}: parameter name`);
        if (!['query', 'header', 'path', 'cookie'].includes(prm.in)) err(`${where}: parameter in`);
        if (!prm.schema && !prm.content) err(`${where}: parameter ${prm.name} schema`);
        if (prm.in === 'path') {
          paramNames.add(prm.name);
          if (prm.required !== true) err(`${where}: path parameter ${prm.name} must be required`);
        }
      }
      for (const t of templated)
        if (!paramNames.has(t)) err(`${where}: path parameter {${t}} not declared`);
      if (op.requestBody) {
        const content = op.requestBody.content;
        if (!content || Object.keys(content).length === 0) err(`${where}: requestBody.content`);
      }
    }
  }

  // every $ref must resolve inside the document
  const walk = (node: unknown, trail: string) => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${trail}/${i}`));
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node as Json)) {
      if (k === '$ref') {
        if (typeof v !== 'string' || !v.startsWith('#/')) {
          err(`${trail}: unsupported $ref ${String(v)}`);
          continue;
        }
        let target: any = spec;
        for (const part of v.slice(2).split('/'))
          target = target?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
        if (target === undefined) err(`${trail}: unresolved $ref ${v}`);
      } else walk(v, `${trail}/${k}`);
    }
  };
  walk(spec, '#');
  return errors;
}

describe('validateOpenApi (the checker itself)', () => {
  const base = () => ({
    openapi: '3.0.0',
    info: { title: 't', version: '1' },
    paths: {
      '/a/{id}': {
        get: {
          parameters: [{ name: 'id', in: 'path', required: true, schema: {} }],
          responses: { 200: { description: 'ok' } },
        },
      },
    },
  });
  it('accepts a minimal valid document', () => {
    expect(validateOpenApi(base())).toEqual([]);
  });
  it('detects missing fields, undeclared path params and dangling $ref', () => {
    const bad: Json = base();
    delete bad.info.version;
    bad.paths['/a/{id}'].get.parameters = [];
    bad.paths['/b'] = {
      post: {
        responses: {
          200: {
            description: 'x',
            content: { 'a/b': { schema: { $ref: '#/components/schemas/Nope' } } },
          },
        },
      },
    };
    const errors = validateOpenApi(bad);
    expect(errors).toEqual(
      expect.arrayContaining([
        'info.version',
        expect.stringContaining('path parameter {id} not declared'),
        expect.stringContaining('unresolved $ref #/components/schemas/Nope'),
      ])
    );
  });
});

describe('generated OpenAPI spec', () => {
  const spec = OpenAPIGenerator.generateSpec('9.9.9', 'http://localhost:3000') as unknown as Json;
  const resolve = (ref: string): Json =>
    ref
      .slice(2)
      .split('/')
      .reduce((n: any, k) => n[k], spec);
  const bodySchema = (p: string): Json =>
    resolve(spec.paths[p].post.requestBody.content['application/json'].schema.$ref);

  it('is structurally valid and all $refs resolve', () => {
    expect(validateOpenApi(spec)).toEqual([]);
  });

  it('uses the given version and the maintainer contact', () => {
    expect(spec.info.version).toBe('9.9.9');
    expect(spec.info.contact).toEqual({
      name: 'Alexander Seymer',
      email: 'alexseymer@gmail.com',
      url: 'https://github.com/alexseymer/r-best-practice-mcp',
    });
  });

  it('documents the filters in the validate-project and validate-file request bodies (v1)', () => {
    for (const p of ['/api/v1/validate-project', '/api/v1/validate-file']) {
      const schema = bodySchema(p);
      expect(Object.keys(schema.properties)).toEqual(
        expect.arrayContaining(['path', 'minSeverity', 'categories', 'maxFindings'])
      );
      expect(schema.required).toEqual(['path']);
      expect(schema.properties.categories.type).toBe('array');
      expect(schema.properties.maxFindings).toMatchObject({
        type: 'integer',
        minimum: 1,
        maximum: 1000,
      });
    }
    expect(Object.keys(bodySchema('/api/v1/validate-project').properties)).toContain('workflow');
  });

  it('documents the practice filters on the v1 list endpoint', () => {
    const names = (spec.paths['/api/v1/practices'].get.parameters as Json[]).map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'workflow',
        'category',
        'minSeverity',
        'tags',
        'enforcement',
        'query',
        'limit',
      ])
    );
  });
});

describe('/health and /openapi.json carry the configured version', () => {
  let ts: TestServer;
  beforeAll(async () => {
    ts = await startTestServer({ GIT_SHA: 'abc1234def', BUILD_TIME: '2026-10-04T10:00:00Z' });
  });
  afterAll(async () => {
    await ts.stop();
  });

  it('/health reports version and build info', async () => {
    const body = (await (await fetch(ts.base + '/health')).json()) as Json;
    expect(body.version).toBe(getRuntimeConfig().version);
    expect(body.version).not.toBe('unknown');
    expect(body.build).toEqual({ commit: 'abc1234def', builtAt: '2026-10-04T10:00:00Z' });
  });

  it('/health build info is null when not provided', async () => {
    const plain = await startTestServer({});
    try {
      const body = (await (await fetch(plain.base + '/health')).json()) as Json;
      expect(body.build).toEqual({ commit: null, builtAt: null });
    } finally {
      await plain.stop();
    }
  });

  it('/openapi.json uses the package version', async () => {
    const spec = (await (await fetch(ts.base + '/openapi.json')).json()) as Json;
    expect(spec.info.version).toBe(getRuntimeConfig().version);
    expect(validateOpenApi(spec)).toEqual([]);
  });
});
