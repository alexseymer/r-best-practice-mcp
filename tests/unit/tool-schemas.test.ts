import http from 'http';
import { AddressInfo } from 'net';
import { RPracticesMCPServer } from '../../src/server';
import { RPracticesWebServer } from '../../src/web-server';
import { OpenAPIGenerator } from '../../src/utils/openapi';
import { TOOL_DEFS, toOpenApiPath } from '../../src/tools/schemas';
import { createTempDir, cleanupTempDir, createFile } from '../fixtures/setup';

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    properties: Record<string, Record<string, unknown>>;
    required?: string[];
  };
}

const sorted = (list: string[]): string[] => [...list].sort();

describe('shared tool definitions', () => {
  let mcp: RPracticesMCPServer;
  let httpServer: http.Server;
  let baseUrl: string;
  let tempDir: string;

  beforeAll(async () => {
    mcp = new RPracticesMCPServer();
    // The rate limiter starts a cleanup interval it never stops; unref it so Jest can exit.
    const realSetInterval = global.setInterval;
    global.setInterval = ((fn: () => void, ms?: number) => {
      const timer = realSetInterval(fn, ms);
      timer.unref();
      return timer;
    }) as typeof setInterval;
    const web = new RPracticesWebServer(0);
    global.setInterval = realSetInterval;
    httpServer = http.createServer((web as unknown as { app: http.RequestListener }).app);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
    tempDir = createTempDir();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    cleanupTempDir(tempDir);
  });

  const mcpTools = (): McpTool[] =>
    (mcp as unknown as { handleListTools(): { tools: McpTool[] } }).handleListTools().tools;

  const callMcp = async (name: string, args: Record<string, unknown>): Promise<any> => {
    const res = await (
      mcp as unknown as {
        handleCallTool(r: unknown): Promise<{ content: Array<{ text: string }> }>;
      }
    ).handleCallTool({ method: 'tools/call', params: { name, arguments: args } });
    return JSON.parse(res.content[0].text);
  };

  const restTools = async (): Promise<any[]> => {
    const body = (await (await fetch(`${baseUrl}/api/tools`)).json()) as any;
    return body.data;
  };

  it('MCP tool list, /api/tools and OpenAPI agree on tools, parameters and required flags', async () => {
    const mcpList = mcpTools();
    const rest = await restTools();
    const spec = OpenAPIGenerator.generateSpec('test', 'http://localhost');

    expect(sorted(mcpList.map((t) => t.name))).toEqual(sorted(TOOL_DEFS.map((t) => t.name)));
    expect(sorted(rest.map((t) => t.name))).toEqual(sorted(mcpList.map((t) => t.name)));

    for (const tool of mcpList) {
      const def = TOOL_DEFS.find((t) => t.name === tool.name)!;
      const restTool = rest.find((t) => t.name === tool.name);

      // MCP vs REST introspection
      const mcpParams = sorted(Object.keys(tool.inputSchema.properties));
      expect(sorted(Object.keys(restTool.parameters))).toEqual(mcpParams);
      expect(sorted(tool.inputSchema.required ?? [])).toEqual(
        sorted(
          Object.entries(restTool.parameters)
            .filter(([, p]: [string, any]) => p.required)
            .map(([n]) => n)
        )
      );
      expect(restTool.method).toBe(def.method);
      expect(restTool.path).toBe(def.path);
      expect(restTool.description).toBe(tool.description);

      // OpenAPI
      const method = def.method.toLowerCase();
      const op = spec.paths[toOpenApiPath(def)]?.[method];
      expect(op).toBeDefined();
      expect(op.operationId).toBe(def.operationId);

      const aliases = Object.values(def.params).flatMap((p) => p.aliases ?? []);
      const extras = Object.keys(def.v1ExtraQueryParams ?? {});
      let specParams: string[];
      let specRequired: string[];
      if (def.method === 'POST') {
        const ref = op.requestBody.content['application/json'].schema.$ref as string;
        const schema = spec.components.schemas[ref.split('/').pop()!];
        specParams = Object.keys(schema.properties);
        specRequired = schema.required ?? [];
      } else {
        const params = (op.parameters as any[]).filter(
          (p) => !aliases.includes(p.name) && !extras.includes(p.name)
        );
        specParams = params.map((p) => p.name);
        specRequired = params.filter((p) => p.required).map((p) => p.name);
        // aliases and v1 extras are documented too
        for (const extra of [...aliases, ...extras]) {
          expect((op.parameters as any[]).some((p) => p.name === extra)).toBe(true);
        }
      }
      expect(sorted(specParams)).toEqual(mcpParams);
      expect(sorted(specRequired)).toEqual(sorted(tool.inputSchema.required ?? []));
    }
  });

  it('every OpenAPI tool path corresponds to a shared tool definition', () => {
    const spec = OpenAPIGenerator.generateSpec('test', 'http://localhost');
    const toolPaths = new Set(TOOL_DEFS.map(toOpenApiPath));
    // REST-only endpoints (no MCP tool) are documented by hand and listed here
    const restOnly = new Set(['/api/validate-upload']);
    const apiPaths = Object.keys(spec.paths).filter((p) => p.startsWith('/api/') && !restOnly.has(p));
    expect(sorted(apiPaths)).toEqual(sorted([...toolPaths]));
    for (const p of restOnly) expect(spec.paths[p]).toBeDefined();
  });

  it('exposes the new filter parameters in MCP schemas', () => {
    const byName = Object.fromEntries(mcpTools().map((t) => [t.name, t.inputSchema.properties]));
    for (const tool of ['validate_project', 'validate_file']) {
      expect(Object.keys(byName[tool])).toEqual(
        expect.arrayContaining(['minSeverity', 'categories', 'maxFindings'])
      );
      expect(byName[tool].categories).toMatchObject({ type: 'array', items: { type: 'string' } });
      expect(byName[tool].maxFindings).toMatchObject({
        type: 'integer',
        minimum: 1,
        maximum: 1000,
      });
    }
    expect(Object.keys(byName.list_practices)).toEqual(
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
    expect(byName.list_practices.limit).toMatchObject({ minimum: 1, maximum: 200 });
    expect(byName.list_practices.enforcement.enum).toEqual(['automated', 'guidance']);
  });

  describe('MCP handlers', () => {
    it('list_practices applies the new filters', async () => {
      const all = await callMcp('list_practices', {});
      const crit = await callMcp('list_practices', { minSeverity: 'critical', limit: 3 });
      expect(crit.error).toBe(false);
      expect(crit.data.practices.length).toBeLessThanOrEqual(3);
      expect(crit.data.practices.every((p: any) => p.severity === 'critical')).toBe(true);
      const q = await callMcp('list_practices', { query: 'roxygen' });
      expect(q.data.practices.length).toBeGreaterThan(0);
      expect(q.data.practices.length).toBeLessThan(all.data.practices.length);
    });

    it('rejects invalid values with INVALID_PARAMETER', async () => {
      for (const [tool, args, param] of [
        ['list_practices', { minSeverity: 'nope' }, 'minSeverity'],
        ['list_practices', { enforcement: 'nope' }, 'enforcement'],
        ['list_practices', { limit: 500 }, 'limit'],
        ['validate_project', { path: tempDir, maxFindings: 0 }, 'maxFindings'],
        ['validate_project', { path: tempDir, categories: ['x'] }, 'categories'],
        ['validate_file', { path: tempDir, minSeverity: 'x' }, 'minSeverity'],
      ] as Array<[string, Record<string, unknown>, string]>) {
        const r = await callMcp(tool, args);
        expect(r.error).toBe(true);
        expect(r.code).toBe('INVALID_PARAMETER');
        expect(r.message.startsWith(param)).toBe(true);
      }
    });

    it('validate_file returns a pre-filter summary and honours filters', async () => {
      const file = createFile(tempDir, 'mcp.qmd', '# Title\n\n```{r}\n1 + 1\n```\n');
      const full = await callMcp('validate_file', { path: file });
      const capped = await callMcp('validate_file', { path: file, maxFindings: 1 });
      expect(full.error).toBe(false);
      expect(full.data.summary.total).toBe(2);
      expect(full.data.findings).toHaveLength(2);
      expect(capped.data.findings).toHaveLength(1);
      expect(capped.data.summary).toEqual(full.data.summary);
    });

    it('validate_project returns a summary', async () => {
      createFile(tempDir, 'DESCRIPTION', 'Package: x\nVersion: 0.1.0\n');
      const r = await callMcp('validate_project', {
        path: tempDir,
        workflow: 'package',
        maxFindings: 1,
      });
      expect(r.error).toBe(false);
      expect(r.data.findings.length).toBeLessThanOrEqual(1);
      expect(r.data.summary.total).toBeGreaterThanOrEqual(r.data.findings.length);
    });
  });

  describe('REST routes', () => {
    const post = async (route: string, body: unknown): Promise<{ status: number; json: any }> => {
      const res = await fetch(`${baseUrl}${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: res.status, json: await res.json() };
    };
    const get = async (route: string): Promise<{ status: number; json: any }> => {
      const res = await fetch(`${baseUrl}${route}`);
      return { status: res.status, json: await res.json() };
    };

    it.each(['/api', '/api/v1'])('%s validate-file filters and summarises', async (prefix) => {
      const file = createFile(tempDir, 'rest.qmd', '# Title\n\n```{r}\n1 + 1\n```\n');
      const full = await post(`${prefix}/validate-file`, { path: file });
      expect(full.status).toBe(200);
      expect(full.json.data.path).toBe(file);
      const capped = await post(`${prefix}/validate-file`, {
        path: file,
        maxFindings: 1,
        categories: ['style', 'documentation', 'structure', 'security'],
      });
      expect(capped.status).toBe(200);
      expect(capped.json.data.findings.length).toBeLessThanOrEqual(1);
      expect(capped.json.data.summary).toEqual(full.json.data.summary);
    });

    it.each(['/api', '/api/v1'])('%s validate-project rejects bad filters', async (prefix) => {
      for (const [body, param] of [
        [{ minSeverity: 'bogus' }, 'minSeverity'],
        [{ categories: ['bogus'] }, 'categories'],
        [{ categories: 'style' }, null],
        [{ maxFindings: 1001 }, 'maxFindings'],
        [{ maxFindings: 'x' }, 'maxFindings'],
      ] as Array<[Record<string, unknown>, string | null]>) {
        const r = await post(`${prefix}/validate-project`, { path: tempDir, ...body });
        if (param === null) {
          expect(r.status).toBe(200); // comma/single string form is accepted
          continue;
        }
        expect(r.status).toBe(400);
        expect(r.json).toMatchObject({ error: true, code: 'INVALID_PARAMETER' });
        expect(r.json.message.startsWith(param)).toBe(true);
      }
    });

    it.each(['/api', '/api/v1'])(
      '%s validate-project returns summary with filters',
      async (prefix) => {
        createFile(tempDir, 'DESCRIPTION', 'Package: x\nVersion: 0.1.0\n');
        const r = await post(`${prefix}/validate-project`, {
          path: tempDir,
          workflow: 'package',
          minSeverity: 'critical',
        });
        expect(r.status).toBe(200);
        expect(r.json.data.findings.every((f: any) => f.severity === 'critical')).toBe(true);
        expect(r.json.data.summary.total).toBeGreaterThanOrEqual(r.json.data.findings.length);
      }
    );

    it('GET /api/practices filters by every parameter', async () => {
      const all = await get('/api/practices');
      const crit = await get('/api/practices?minSeverity=critical');
      expect(crit.status).toBe(200);
      expect(crit.json.data.practices.every((p: any) => p.severity === 'critical')).toBe(true);
      expect(crit.json.data.practices.length).toBeLessThan(all.json.data.practices.length);

      const q = await get('/api/practices?q=ROXYGEN');
      const q2 = await get('/api/practices?query=roxygen');
      expect(q.json.data.practices.length).toBeGreaterThan(0);
      expect(q2.json.data.practices).toEqual(q.json.data.practices);

      const lim = await get('/api/practices?limit=2&workflow=package&category=documentation');
      expect(lim.json.data.practices.length).toBeLessThanOrEqual(2);

      const auto = await get('/api/practices?enforcement=automated');
      const guide = await get('/api/practices?enforcement=guidance');
      expect(auto.json.data.practices.length + guide.json.data.practices.length).toBe(
        all.json.data.practices.length
      );

      const tagged = await get('/api/practices?tags=shiny,testing');
      expect(
        tagged.json.data.practices.every((p: any) =>
          (p.tags ?? []).some((t: string) => ['shiny', 'testing'].includes(t))
        )
      ).toBe(true);
    });

    it('GET /api/practices and /api/v1/practices reject invalid values', async () => {
      for (const prefix of ['/api', '/api/v1']) {
        for (const [qs, code] of [
          ['minSeverity=huge', 'INVALID_PARAMETER'],
          ['category=misc', 'INVALID_PARAMETER'],
          ['enforcement=manual', 'INVALID_PARAMETER'],
          ['limit=0', 'INVALID_PARAMETER'],
          ['limit=201', 'INVALID_PARAMETER'],
          ['limit=abc', 'INVALID_PARAMETER'],
          ['workflow=cobol', 'INVALID_WORKFLOW'],
        ]) {
          const r = await get(`${prefix}/practices?${qs}`);
          expect(r.status).toBe(400);
          expect(r.json).toMatchObject({ error: true, code });
        }
      }
    });

    it('v1 applies filters before pagination', async () => {
      const filtered = await get('/api/v1/practices?minSeverity=critical&limit=2&offset=1');
      const critTotal = (await get('/api/practices?minSeverity=critical')).json.data.practices
        .length;
      expect(filtered.status).toBe(200);
      expect(filtered.json.pagination.total).toBe(critTotal);
      expect(filtered.json.pagination.limit).toBe(2);
      expect(filtered.json.data).toHaveLength(Math.min(2, Math.max(0, critTotal - 1)));
    });
  });
});
