/**
 * End-to-end tests: start the compiled server as a child process and talk JSON-RPC over stdio,
 * the same way Claude Code and Cursor do.
 */
import { ChildProcessWithoutNullStreams, spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const ENTRY = path.join(ROOT, 'dist/index.js');
const EXAMPLE_PACKAGE = path.join(ROOT, 'tests/fixtures/examples/example-package');
const TIMEOUT_MS = 20000;

type Json = Record<string, any>;

class StdioClient {
  private proc: ChildProcessWithoutNullStreams;
  private buffer = '';
  private nextId = 1;
  private pending = new Map<number, (msg: Json) => void>();
  /** Requests the server sends to the client (for example elicitation/create). */
  public onServerRequest: (msg: Json) => Json | undefined = () => undefined;
  public stderr = '';

  constructor() {
    this.proc = spawn(process.execPath, [ENTRY], { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk: string) => this.onData(chunk));
    this.proc.stderr.setEncoding('utf8');
    this.proc.stderr.on('data', (chunk: string) => (this.stderr += chunk));
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as Json;
      if (msg.method && msg.id !== undefined) {
        const reply = this.onServerRequest(msg);
        this.send({ jsonrpc: '2.0', id: msg.id, result: reply ?? {} });
      } else if (msg.id !== undefined && this.pending.has(msg.id)) {
        this.pending.get(msg.id)!(msg);
        this.pending.delete(msg.id);
      }
    }
  }

  send(msg: Json): void {
    this.proc.stdin.write(JSON.stringify(msg) + '\n');
  }

  request(method: string, params: Json = {}): Promise<Json> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), TIMEOUT_MS);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method: string, params: Json = {}): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  async initialize(capabilities: Json = {}): Promise<Json> {
    const res = await this.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities,
      clientInfo: { name: 'e2e-test', version: '0.0.0' },
    });
    this.notify('notifications/initialized');
    return res;
  }

  /** Call a tool and parse the JSON text it returns. */
  async callTool(name: string, args: Json): Promise<Json> {
    const res = await this.request('tools/call', { name, arguments: args });
    return JSON.parse(res.result.content[0].text);
  }

  /** Stop the server and wait until the process has exited, so Jest has no open handles left. */
  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.proc.exitCode !== null || this.proc.signalCode !== null) return resolve();
      this.proc.once('exit', () => resolve());
      this.proc.stdin.end();
      this.proc.kill();
    });
  }
}

const waitForExit = (client: StdioClient): Promise<number | null> =>
  new Promise((resolve) => {
    (client as unknown as { proc: ChildProcessWithoutNullStreams }).proc.on('exit', (code) => resolve(code));
  });

describe('stdio server (end to end)', () => {
  beforeAll(() => {
    if (!fs.existsSync(ENTRY)) execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
  });

  let client: StdioClient;

  beforeEach(async () => {
    client = new StdioClient();
    await client.initialize();
  });

  afterEach(() => client.close());

  describe('handshake and discovery', () => {
    it('declares tools, prompts and resources', async () => {
      const other = new StdioClient();
      try {
        const init = await other.initialize();
        expect(init.result.serverInfo.name).toBe('r-best-practices-mcp');
        expect(Object.keys(init.result.capabilities).sort()).toEqual(['prompts', 'resources', 'tools']);
      } finally {
        await other.close();
      }
    });

    it('lists exactly three tools with input schemas', async () => {
      const res = await client.request('tools/list');
      expect(res.result.tools.map((t: Json) => t.name).sort()).toEqual([
        'check_project',
        'create_project',
        'get_practice',
      ]);
      for (const tool of res.result.tools) {
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.description.length).toBeGreaterThan(20);
      }
    });

    it('lists the four guided prompts', async () => {
      const res = await client.request('prompts/list');
      expect(res.result.prompts.map((p: Json) => p.name).sort()).toEqual([
        'neue-datenanalyse',
        'neue-shiny-app',
        'neues-quarto-projekt',
        'neues-r-paket',
      ]);
    });

    it('lists 74 resources: the index and one per practice', async () => {
      const res = await client.request('resources/list');
      expect(res.result.resources).toHaveLength(74);
      expect(res.result.resources.map((r: Json) => r.uri)).toContain('practices://all');
    });
  });

  describe('check_project', () => {
    it('detects and validates a project folder', async () => {
      const res = await client.callTool('check_project', { path: EXAMPLE_PACKAGE });
      expect(res.error).toBe(false);
      expect(res.data.detection.workflow).toBe('package');
      expect(res.data.summary).toBeDefined();
    });

    it('returns PATH_NOT_FOUND for a missing folder', async () => {
      const res = await client.callTool('check_project', { path: '/no/such/folder' });
      expect(res.code).toBe('PATH_NOT_FOUND');
    });

    it('returns INVALID_PARAMETER for a non-string path', async () => {
      const res = await client.callTool('check_project', { path: 42 });
      expect(res.code).toBe('INVALID_PARAMETER');
    });
  });

  describe('create_project', () => {
    it('asks for a missing name with elicitation when the client supports it', async () => {
      await client.initialize({ elicitation: {} });
      client.onServerRequest = (msg) => {
        if (msg.method !== 'elicitation/create') return undefined;
        expect(msg.params.requestedSchema.required).toEqual(['projectName']);
        return { action: 'accept', content: { projectName: 'elicitpkg', authorName: 'Grace Hopper' } };
      };
      const res = await client.callTool('create_project', { type: 'package' });
      expect(res.error).toBe(false);
      expect(res.data.projectName).toBe('elicitpkg');
      const description = res.data.files.find((f: Json) => f.path === 'DESCRIPTION');
      expect(description.content).toContain('Grace Hopper');
    });

    it('returns NEEDS_INPUT with questions when the client has no elicitation', async () => {
      const res = await client.callTool('create_project', { type: 'shiny' });
      expect(res.code).toBe('NEEDS_INPUT');
      expect(res.questions).toHaveLength(3);
    });

    it('creates every project type', async () => {
      for (const type of ['package', 'shiny', 'quarto', 'rmarkdown', 'analysis']) {
        const res = await client.callTool('create_project', { type, projectName: 'stdioproject' });
        expect({ type, error: res.error }).toEqual({ type, error: false });
      }
    });
  });

  describe('get_practice and resources', () => {
    it('returns a practice by id', async () => {
      const res = await client.callTool('get_practice', { id: 'pkg-readme' });
      expect(res.data.id).toBe('pkg-readme');
    });

    it('reads a practice resource as markdown', async () => {
      const res = await client.request('resources/read', { uri: 'practice://pkg-readme' });
      expect(res.result.contents[0].mimeType).toBe('text/markdown');
      expect(res.result.contents[0].text).toMatch(/^# /);
    });

    it('reads the index resource', async () => {
      const res = await client.request('resources/read', { uri: 'practices://all' });
      expect(res.result.contents[0].text).toContain('# R best practices');
    });

    it('answers an unknown resource with a JSON-RPC error', async () => {
      const res = await client.request('resources/read', { uri: 'practice://nope' });
      expect(res.error).toBeDefined();
    });
  });

  describe('prompts', () => {
    it('returns the package prompt with the matching project type', async () => {
      const res = await client.request('prompts/get', { name: 'neues-r-paket' });
      expect(res.result.messages[0].content.text).toContain('type="package"');
    });

    it('honours the format argument of the Quarto prompt', async () => {
      const res = await client.request('prompts/get', {
        name: 'neues-quarto-projekt',
        arguments: { format: 'rmarkdown' },
      });
      expect(res.result.messages[0].content.text).toContain('type="rmarkdown"');
    });

    it('answers an unknown prompt with a JSON-RPC error', async () => {
      const res = await client.request('prompts/get', { name: 'nope' });
      expect(res.error).toBeDefined();
    });
  });

  describe('protocol robustness', () => {
    it('answers an unknown method with method-not-found', async () => {
      const res = await client.request('does/not/exist');
      expect(res.error.code).toBe(-32601);
    });

    it('answers an unknown tool with UNKNOWN_TOOL', async () => {
      const res = await client.callTool('list_practices', {});
      expect(res.code).toBe('UNKNOWN_TOOL');
    });

    it('keeps serving after a malformed line', async () => {
      client.send({ not: 'json-rpc-but-valid-json' });
      await new Promise((r) => setTimeout(r, 200));
      const res = await client.request('tools/list');
      expect(res.result.tools).toHaveLength(3);
      expect(client.stderr).not.toMatch(/Uncaught error/);
    });

    it('exits cleanly when the client closes stdin', async () => {
      const exit = waitForExit(client);
      (client as unknown as { proc: ChildProcessWithoutNullStreams }).proc.stdin.end();
      expect(await exit).toBe(0);
    });
  });
});
