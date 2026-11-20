import { RPracticesMCPServer } from '../../src/server';
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

describe('MCP tool definitions', () => {
  let mcp: RPracticesMCPServer;
  let tempDir: string;

  beforeAll(() => {
    mcp = new RPracticesMCPServer();
    tempDir = createTempDir();
  });

  afterAll(() => {
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

    it('validate_project returns warnings for an unrecognised folder', async () => {
      const empty = createTempDir();
      const r = await callMcp('validate_project', { path: empty });
      cleanupTempDir(empty);
      expect(r.error).toBe(false);
      expect(r.data.workflow).toBe('unknown');
      expect(r.data.findings).toEqual([]);
      expect(r.data.warnings[0]).toMatch(/no workflow-specific checks ran/);
    });

    it('validate_project has no warnings for a known workflow', async () => {
      const r = await callMcp('validate_project', { path: tempDir, workflow: 'package' });
      expect(r.data.warnings).toBeUndefined();
    });

    it('describes warnings in the validate_project tool description', () => {
      const tool = mcpTools().find((t) => t.name === 'validate_project');
      expect(tool?.description).toMatch(/warnings/);
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
});
