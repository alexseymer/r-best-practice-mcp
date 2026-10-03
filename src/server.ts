import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  TextContent,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { WorkflowDetector } from './engine/detector.js';
import { Validator } from './engine/validator.js';
import { TemplateGenerator } from './engine/template-generator.js';
import { kb } from './data/knowledge-base.js';
import { logger } from './utils/logger.js';
import { FileUtils } from './utils/file.js';
import { toMcpTools } from './tools/schemas.js';
import { parseFindingFilters, parsePracticeFilters } from './utils/query-params.js';

function invalidParameter(message: string): { error: true; code: string; message: string } {
  return { error: true, code: 'INVALID_PARAMETER', message };
}

export class RPracticesMCPServer {
  private server: Server;
  private detector: WorkflowDetector;
  private validator: Validator;
  private templateGenerator: TemplateGenerator;

  constructor() {
    this.server = new Server(
      {
        name: 'r-best-practices-mcp',
        version: '1.0.0',
      },
      // Without this capability the SDK refuses to register the tools handlers.
      { capabilities: { tools: {} } }
    );
    this.detector = new WorkflowDetector();
    this.validator = new Validator();
    this.templateGenerator = new TemplateGenerator();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => this.handleListTools());

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleCallTool(request)
    );
  }

  private handleListTools(): { tools: Tool[] } {
    // Tool names, descriptions and parameters come from tools/schemas.ts (shared with REST).
    return { tools: toMcpTools() as Tool[] };
  }

  private async handleCallTool(request: {
    method: string;
    params: { name: string; arguments?: Record<string, unknown> };
  }): Promise<{ content: TextContent[] }> {
    const { name, arguments: args = {} } = request.params;
    logger.info(`Tool called: ${name}`, args);

    try {
      let result: unknown;

      switch (name) {
        case 'detect_workflow':
          result = await this.detectWorkflow(args);
          break;
        case 'validate_project':
          result = await this.validateProject(args);
          break;
        case 'validate_file':
          result = await this.validateFile(args);
          break;
        case 'get_practice':
          result = this.getPractice(args);
          break;
        case 'list_practices':
          result = this.listPractices(args);
          break;
        case 'generate_template':
          result = await this.generateTemplate(args);
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

  private async detectWorkflow(args: Record<string, unknown>): Promise<unknown> {
    const path = args.path as string;
    const result = await this.detector.detect(path);
    return {
      error: false,
      data: result,
      timestamp: Date.now(),
    };
  }

  private async validateProject(args: Record<string, unknown>): Promise<unknown> {
    const path = args.path as string;
    const specifiedWorkflow = args.workflow as string | undefined;

    const filters = parseFindingFilters(args);
    if (!filters.ok) return invalidParameter(filters.message);

    const exists = await FileUtils.isDirectory(path);
    if (!exists) {
      return {
        error: true,
        code: 'PATH_NOT_FOUND',
        message: `Directory not found: ${path}`,
      };
    }

    // Auto-detect workflow if not specified
    let workflow = specifiedWorkflow || 'unknown';
    if (!specifiedWorkflow) {
      const detection = await this.detector.detect(path);
      workflow = detection.workflow;
    }

    // Validate project
    const result = await this.validator.validateProject(path, workflow as any, filters.value);

    return {
      error: false,
      data: result,
      timestamp: Date.now(),
    };
  }

  private async validateFile(args: Record<string, unknown>): Promise<unknown> {
    const path = args.path as string;

    const filters = parseFindingFilters(args);
    if (!filters.ok) return invalidParameter(filters.message);

    const exists = await FileUtils.exists(path);
    if (!exists) {
      return {
        error: true,
        code: 'FILE_NOT_FOUND',
        message: `File not found: ${path}`,
      };
    }

    // Validate file
    const data = await this.validator.validateFileWithSummary(path, filters.value);

    return {
      error: false,
      data,
      timestamp: Date.now(),
    };
  }

  private getPractice(args: Record<string, unknown>): unknown {
    const id = args.id as string;
    const practice = kb.getPractice(id);

    if (!practice) {
      return {
        error: true,
        code: 'NOT_FOUND',
        message: `Practice not found: ${id}`,
      };
    }

    return {
      error: false,
      data: practice,
      timestamp: Date.now(),
    };
  }

  private listPractices(args: Record<string, unknown>): unknown {
    const options = parsePracticeFilters(args);
    if (!options.ok) {
      return { error: true, code: options.code, message: options.message };
    }

    return {
      error: false,
      data: kb.listPractices(options.value),
      timestamp: Date.now(),
    };
  }

  private async generateTemplate(args: Record<string, unknown>): Promise<unknown> {
    const workflow = args.workflow as string;
    const projectName = args.projectName as string | undefined;
    const authorName = args.authorName as string | undefined;
    const authorEmail = args.authorEmail as string | undefined;

    if (!workflow) {
      return {
        error: true,
        code: 'MISSING_WORKFLOW',
        message: 'workflow parameter is required',
      };
    }

    try {
      const result = await this.templateGenerator.generate(workflow as any, {
        projectName,
        authorName,
        authorEmail,
      });

      return {
        error: false,
        data: result,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Error generating template for ${workflow}`, error);
      return {
        error: true,
        code: 'TEMPLATE_GENERATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async start(): Promise<void> {
    logger.info('Starting R Best Practices MCP Server');
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Server connected and running');
  }
}
