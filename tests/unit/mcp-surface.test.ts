import path from 'path';
import { RPracticesMCPServer } from '../../src/server';
import { getPrompt, PROMPTS } from '../../src/prompts';
import { listResources, readResource } from '../../src/resources';

const EXAMPLE_PACKAGE = path.resolve(__dirname, '../fixtures/examples/example-package');

describe('MCP surface: tools, prompts, resources', () => {
  let mcp: RPracticesMCPServer;

  beforeAll(() => {
    mcp = new RPracticesMCPServer();
  });

  const internals = () => mcp as unknown as {
    handleListTools(): { tools: Array<{ name: string; inputSchema: { required?: string[] } }> };
    handleCallTool(r: unknown): Promise<{ content: Array<{ text: string }> }>;
    server: {
      getClientCapabilities(): Record<string, unknown> | undefined;
      elicitInput: jest.Mock;
    };
  };

  const callTool = async (name: string, args: Record<string, unknown>): Promise<any> => {
    const res = await internals().handleCallTool({
      method: 'tools/call',
      params: { name, arguments: args },
    });
    return JSON.parse(res.content[0].text);
  };

  describe('tool list', () => {
    it('exposes exactly three tools', () => {
      const names = internals().handleListTools().tools.map((t) => t.name);
      expect(names.sort()).toEqual(['check_project', 'create_project', 'get_practice']);
    });

    it('requires the arguments each tool needs', () => {
      const byName = Object.fromEntries(
        internals().handleListTools().tools.map((t) => [t.name, t.inputSchema])
      );
      expect(byName.check_project.required).toEqual(['path']);
      expect(byName.get_practice.required).toEqual(['id']);
      expect(byName.create_project.required).toEqual(['type']);
    });
  });

  describe('check_project', () => {
    it('detects the project type and returns findings', async () => {
      const res = await callTool('check_project', { path: EXAMPLE_PACKAGE });
      expect(res.error).toBe(false);
      expect(res.data.detection.workflow).toBe('package');
      expect(Array.isArray(res.data.findings)).toBe(true);
      expect(res.data.summary).toBeDefined();
    });

    it('applies minSeverity to the returned findings', async () => {
      const res = await callTool('check_project', { path: EXAMPLE_PACKAGE, minSeverity: 'critical' });
      expect(res.data.findings.every((f: any) => f.severity === 'critical')).toBe(true);
    });

    it('requires a path', async () => {
      const res = await callTool('check_project', {});
      expect(res.code).toBe('INVALID_PARAMETER');
    });

    it('requires an absolute path', async () => {
      const res = await callTool('check_project', { path: 'relative/folder' });
      expect(res.code).toBe('INVALID_PARAMETER');
      expect(res.message).toContain('absolute');
    });

    it('explains when the path is a file, not a folder', async () => {
      const res = await callTool('check_project', { path: path.join(EXAMPLE_PACKAGE, 'DESCRIPTION') });
      expect(res.code).toBe('NOT_A_FOLDER');
    });

    it('reports a missing folder', async () => {
      const res = await callTool('check_project', { path: '/definitely/not/here' });
      expect(res.code).toBe('PATH_NOT_FOUND');
    });

    it('rejects an unknown project type', async () => {
      const res = await callTool('check_project', { path: EXAMPLE_PACKAGE, workflow: 'python' });
      expect(res.code).toBe('INVALID_PARAMETER');
    });
  });

  describe('get_practice', () => {
    it('returns one practice', async () => {
      const res = await callTool('get_practice', { id: 'pkg-readme' });
      expect(res.error).toBe(false);
      expect(res.data.id).toBe('pkg-readme');
    });

    it('reports an unknown id', async () => {
      const res = await callTool('get_practice', { id: 'no-such-practice' });
      expect(res.code).toBe('NOT_FOUND');
    });
  });

  describe('create_project', () => {
    it('returns files for a package', async () => {
      const res = await callTool('create_project', { type: 'package', projectName: 'mypkg', authorName: 'Ada' });
      expect(res.error).toBe(false);
      expect(res.data.workflow).toBe('package');
      const description = res.data.files.find((f: any) => f.path === 'DESCRIPTION');
      expect(description.content).toContain('Package: mypkg');
      expect(description.content).toContain('Title: Utility Functions');
      expect(description.content).not.toContain('Brief Title');
    });

    it('returns files for every supported project type', async () => {
      for (const type of ['package', 'shiny', 'quarto', 'rmarkdown', 'analysis']) {
        const res = await callTool('create_project', { type, projectName: 'demoproject' });
        expect({ type, error: res.error }).toEqual({ type, error: false });
        expect(res.data.files.length).toBeGreaterThan(0);
      }
    });

    it('asks for the project name when it is missing', async () => {
      const res = await callTool('create_project', { type: 'shiny' });
      expect(res.code).toBe('NEEDS_INPUT');
      expect(res.questions.map((q: any) => q.key)).toEqual(['projectName', 'authorName', 'authorEmail']);
    });

    it('rejects an invalid package name', async () => {
      const res = await callTool('create_project', { type: 'package', projectName: 'my-pkg' });
      expect(res.code).toBe('INVALID_PARAMETER');
    });

    it('rejects an unknown type', async () => {
      const res = await callTool('create_project', { type: 'python', projectName: 'x' });
      expect(res.code).toBe('INVALID_PARAMETER');
    });

    it('asks the user with elicitation when the client supports it', async () => {
      const original = internals().server.getClientCapabilities;
      const originalElicit = internals().server.elicitInput;
      internals().server.getClientCapabilities = () => ({ elicitation: {} });
      internals().server.elicitInput = jest.fn().mockResolvedValue({
        action: 'accept',
        content: { projectName: 'askedpkg', authorName: 'Grace' },
      });
      try {
        const res = await callTool('create_project', { type: 'package' });
        expect(internals().server.elicitInput).toHaveBeenCalledTimes(1);
        expect(res.error).toBe(false);
        expect(res.data.projectName).toBe('askedpkg');
      } finally {
        internals().server.getClientCapabilities = original;
        internals().server.elicitInput = originalElicit;
      }
    });

    it('reports cancellation when the user declines elicitation', async () => {
      const original = internals().server.getClientCapabilities;
      const originalElicit = internals().server.elicitInput;
      internals().server.getClientCapabilities = () => ({ elicitation: {} });
      internals().server.elicitInput = jest.fn().mockResolvedValue({ action: 'decline' });
      try {
        const res = await callTool('create_project', { type: 'package' });
        expect(res.code).toBe('CANCELLED');
      } finally {
        internals().server.getClientCapabilities = original;
        internals().server.elicitInput = originalElicit;
      }
    });
  });

  describe('prompts', () => {
    it('offers the four guided project prompts in German', () => {
      expect(PROMPTS.map((p) => p.name).sort()).toEqual([
        'neue-datenanalyse',
        'neue-shiny-app',
        'neues-quarto-projekt',
        'neues-r-paket',
      ]);
    });

    it('tells the assistant to call create_project with the matching type', () => {
      const prompt = getPrompt('neues-r-paket');
      const text = (prompt!.messages[0].content as { text: string }).text;
      expect(text).toContain('type="package"');
      expect(text).toContain('create_project');
    });

    it('lets the quarto prompt create an R Markdown project', () => {
      const prompt = getPrompt('neues-quarto-projekt', { format: 'rmarkdown' });
      const text = (prompt!.messages[0].content as { text: string }).text;
      expect(text).toContain('type="rmarkdown"');
    });

    it('returns nothing for an unknown prompt', () => {
      expect(getPrompt('does-not-exist')).toBeUndefined();
    });
  });

  describe('resources', () => {
    it('lists the index and one resource per practice', () => {
      const uris = listResources().map((r) => r.uri);
      expect(uris).toContain('practices://all');
      expect(uris).toContain('practice://pkg-readme');
    });

    it('reads a practice as markdown', () => {
      const text = readResource('practice://pkg-readme');
      expect(text).toMatch(/^# /);
      expect(text).toContain('pkg-readme');
    });

    it('reads the index', () => {
      expect(readResource('practices://all')).toContain('# R best practices');
    });

    it('returns nothing for an unknown resource', () => {
      expect(readResource('practice://nope')).toBeUndefined();
    });
  });
});
