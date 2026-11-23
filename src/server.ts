import { isAbsolute } from 'path';
import { getRuntimeConfig } from './config/runtime.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  TextContent,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { WorkflowDetector } from './engine/detector.js';
import { Validator } from './engine/validator.js';
import type { FindingFilterOptions } from './engine/finding-filters.js';
import { TemplateGenerator } from './engine/template-generator.js';
import { kb } from './data/knowledge-base.js';
import { logger } from './utils/logger.js';
import { FileUtils } from './utils/file.js';
import { VALID_WORKFLOWS } from './utils/security.js';
import { parseFindingFilters } from './utils/query-params.js';
import { nodeProjectFs } from './engine/project-fs-node.js';
import { createMemoryProjectFs } from './engine/project-fs.js';
import { toolsFor, PROJECT_TYPES, type ServerMode } from './tools/schemas.js';
import { sanitizeFiles } from './check-files.js';
import { PROMPTS, getPrompt } from './prompts.js';
import { listResources, readResource } from './resources.js';
import { createProject, PROJECT_QUESTIONS, type ProjectAnswers, type ProjectType } from './create-project.js';

function invalidParameter(message: string): { error: true; code: string; message: string } {
  return { error: true, code: 'INVALID_PARAMETER', message };
}

function stringArg(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Findings of an in-memory project carry "/"-rooted paths; clients expect project-relative ones. */
function stripRoot(result: unknown): unknown {
  const value = result as { data?: { findings?: Array<{ file?: string }>; filePath?: string } };
  for (const finding of value.data?.findings ?? []) {
    if (finding.file?.startsWith('/')) finding.file = finding.file.slice(1);
  }
  if (value.data) delete value.data.filePath;
  return result;
}

export interface ServerOptions {
  /** `local` (default): stdio on the user's machine. `remote`: hosted over HTTP, never reads the server's disk. */
  mode?: ServerMode;
}

export class RPracticesMCPServer {
  private server: Server;
  private mode: ServerMode;
  private detector: WorkflowDetector;
  private validator: Validator;
  private templateGenerator: TemplateGenerator;

  constructor(options: ServerOptions = {}) {
    this.mode = options.mode ?? 'local';
    this.server = new Server(
      {
        name: 'r-best-practices-mcp',
        version: getRuntimeConfig().version,
      },
      // Without these capabilities the SDK refuses to register the matching handlers.
      { capabilities: { tools: {}, prompts: {}, resources: {} } }
    );
    this.detector = new WorkflowDetector(nodeProjectFs);
    this.validator = new Validator(nodeProjectFs);
    this.templateGenerator = new TemplateGenerator();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => this.handleListTools());

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleCallTool(request)
    );

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: PROMPTS }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const prompt = getPrompt(request.params.name, request.params.arguments ?? {});
      if (!prompt) throw new Error(`Unknown prompt: ${request.params.name}`);
      return prompt;
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: listResources(),
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const text = readResource(request.params.uri);
      if (text === undefined) throw new Error(`Unknown resource: ${request.params.uri}`);
      return {
        contents: [{ uri: request.params.uri, mimeType: 'text/markdown', text }],
      };
    });
  }

  private handleListTools(): { tools: Tool[] } {
    return { tools: toolsFor(this.mode) };
  }

  private async handleCallTool(request: {
    method: string;
    params: { name: string; arguments?: Record<string, unknown> };
  }): Promise<{ content: TextContent[] }> {
    const { name, arguments: args = {} } = request.params;
    // Only names are logged: arguments can hold a user's file contents.
    logger.info(`Tool called: ${name} (${Object.keys(args).join(', ')})`);

    try {
      let result: unknown;

      // A tool that this mode does not offer cannot be called by guessing its name.
      const offered = toolsFor(this.mode).some((tool) => tool.name === name);

      switch (offered ? name : '') {
        case 'check_project':
          result = await this.checkProject(args);
          break;
        case 'check_files':
          result = await this.checkFiles(args);
          break;
        case 'get_practice':
          result = this.getPractice(args);
          break;
        case 'create_project':
          result = await this.createProject(args);
          break;
        default:
          result = {
            error: true,
            code: 'UNKNOWN_TOOL',
            message: `Unknown tool: ${name}`,
          };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result || { error: 'No result' }),
          },
        ],
      };
    } catch (error) {
      logger.error(`Error in tool ${name}`, error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              code: 'TOOL_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
      };
    }
  }

  private async checkProject(args: Record<string, unknown>): Promise<unknown> {
    const path = stringArg(args.path);
    if (!path) return invalidParameter('path is required');

    const filters = parseFindingFilters(args);
    if (!filters.ok) return invalidParameter(filters.message);

    const workflowArg = stringArg(args.workflow);
    if (workflowArg && !(VALID_WORKFLOWS as readonly string[]).includes(workflowArg)) {
      return invalidParameter(`Unknown project type: ${workflowArg}`);
    }

    // The server runs in the client's own process, so a relative path would resolve against an unknown folder.
    if (!isAbsolute(path)) {
      return invalidParameter(`path must be an absolute path, got: ${path}`);
    }

    if (!(await FileUtils.isDirectory(path))) {
      if (await FileUtils.exists(path)) {
        return {
          error: true,
          code: 'NOT_A_FOLDER',
          message: `Expected a project folder, but this is a file: ${path}. Pass the folder that contains it.`,
        };
      }
      return {
        error: true,
        code: 'PATH_NOT_FOUND',
        message: `Directory not found: ${path}`,
      };
    }

    return this.detectAndValidate(this.detector, this.validator, path, workflowArg, filters.value);
  }

  /** Validate files that arrive as text. Everything stays in memory; the server's disk is never read. */
  private async checkFiles(args: Record<string, unknown>): Promise<unknown> {
    const sanitized = sanitizeFiles(args.files);
    if (!sanitized.ok) return invalidParameter(sanitized.message);

    const filters = parseFindingFilters(args);
    if (!filters.ok) return invalidParameter(filters.message);

    const workflowArg = stringArg(args.workflow);
    if (workflowArg && !(VALID_WORKFLOWS as readonly string[]).includes(workflowArg)) {
      return invalidParameter(`Unknown project type: ${workflowArg}`);
    }

    const fsys = createMemoryProjectFs(sanitized.files);
    const result = await this.detectAndValidate(
      new WorkflowDetector(fsys),
      new Validator(fsys),
      '/',
      workflowArg,
      filters.value
    );
    return stripRoot(result);
  }

  private async detectAndValidate(
    detector: WorkflowDetector,
    validator: Validator,
    dir: string,
    workflowArg: string | undefined,
    filters: FindingFilterOptions
  ): Promise<unknown> {
    const detection = await detector.detect(dir);
    const workflow = (workflowArg ?? detection.workflow) as Parameters<Validator['validateProject']>[1];
    const validation = await validator.validateProject(dir, workflow, filters);

    return {
      error: false,
      data: {
        detection: {
          workflow,
          confidence: detection.confidence,
          indicators: detection.indicators,
        },
        ...validation,
      },
      timestamp: Date.now(),
    };
  }

  private getPractice(args: Record<string, unknown>): unknown {
    const id = stringArg(args.id);
    const practice = id ? kb.getPractice(id) : undefined;

    if (!practice) {
      return {
        error: true,
        code: 'NOT_FOUND',
        message: `Practice not found: ${id ?? ''}`,
      };
    }

    return {
      error: false,
      data: practice,
      timestamp: Date.now(),
    };
  }

  private async createProject(args: Record<string, unknown>): Promise<unknown> {
    const type = stringArg(args.type);
    if (!type || !(PROJECT_TYPES as readonly string[]).includes(type)) {
      return invalidParameter(`type must be one of: ${PROJECT_TYPES.join(', ')}`);
    }

    let answers: ProjectAnswers = {
      projectName: stringArg(args.projectName),
      authorName: stringArg(args.authorName),
      authorEmail: stringArg(args.authorEmail),
    };

    // Ask the user directly when the client supports elicitation; otherwise the response below
    // lists the questions and the assistant asks them in the chat.
    if (!answers.projectName && this.clientSupportsElicitation()) {
      const response = await this.server.elicitInput({
        message: 'Which project should I create?',
        requestedSchema: {
          type: 'object',
          properties: Object.fromEntries(
            PROJECT_QUESTIONS.map(({ key, question }) => [key, { type: 'string', title: question }])
          ),
          required: ['projectName'],
        },
      });
      if (response.action !== 'accept') {
        return { error: true, code: 'CANCELLED', message: 'The user did not provide the project details.' };
      }
      answers = { ...answers, ...(response.content as ProjectAnswers) };
    }

    const result = await createProject(type as ProjectType, answers, this.templateGenerator);
    if (!result.ok) {
      return {
        error: true,
        code: result.code,
        message: result.message,
        ...(result.questions ? { questions: result.questions } : {}),
      };
    }

    const { template } = result;
    return {
      error: false,
      data: {
        type,
        workflow: template.workflow,
        projectName: answers.projectName,
        files: template.files,
        directories: template.directories,
        nextSteps: 'Create the directories, then write each file relative to the target folder.',
      },
      timestamp: Date.now(),
    };
  }

  private clientSupportsElicitation(): boolean {
    // Hosted requests are stateless, so the server cannot ask the user a follow-up question.
    return this.mode === 'local' && this.server.getClientCapabilities()?.elicitation !== undefined;
  }

  /** Serve one transport: stdio for the local server, one HTTP request at a time for the hosted one. */
  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
  }

  async start(): Promise<void> {
    logger.info('Starting R Best Practices MCP Server');
    await this.connect(new StdioServerTransport());
    logger.info('Server connected and running');
  }
}
