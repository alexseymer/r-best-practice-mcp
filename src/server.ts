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
import { ComplexityAnalyzer } from './engine/complexity-analyzer.js';
import { DependencyAnalyzer } from './engine/dependency-analyzer.js';
import { PerformanceAnalyzer } from './engine/performance-analyzer.js';
import { CustomRuleEngine } from './engine/custom-rules.js';
import { AutomatedFixer } from './engine/automated-fixer.js';
import { kb } from './data/knowledge-base.js';
import { logger } from './utils/logger.js';
import { FileUtils } from './utils/file.js';

export class RPracticesMCPServer {
  private server: Server;
  private detector: WorkflowDetector;
  private validator: Validator;
  private templateGenerator: TemplateGenerator;
  private complexityAnalyzer: ComplexityAnalyzer;
  private dependencyAnalyzer: DependencyAnalyzer;
  private performanceAnalyzer: PerformanceAnalyzer;
  private ruleEngine: CustomRuleEngine;
  private fixer: AutomatedFixer;

  constructor() {
    this.server = new Server({
      name: 'r-best-practices-mcp',
      version: '1.0.0',
    });
    this.detector = new WorkflowDetector();
    this.validator = new Validator();
    this.templateGenerator = new TemplateGenerator();
    this.complexityAnalyzer = new ComplexityAnalyzer();
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.ruleEngine = new CustomRuleEngine();
    this.fixer = new AutomatedFixer();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () =>
      this.handleListTools()
    );

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleCallTool(request)
    );
  }

  private handleListTools(): { tools: Tool[] } {
    return {
      tools: [
        {
          name: 'detect_workflow',
          description: 'Detect the R workflow type from a directory path',
          inputSchema: {
            type: 'object' as const,
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to analyze',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'validate_project',
          description: 'Validate an R project against best practices',
          inputSchema: {
            type: 'object' as const,
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to validate',
              },
              workflow: {
                type: 'string',
                description: 'Optional workflow type (auto-detected if omitted)',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'validate_file',
          description: 'Validate a single R or Quarto file',
          inputSchema: {
            type: 'object' as const,
            properties: {
              path: {
                type: 'string',
                description: 'File path to validate',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'get_practice',
          description: 'Get details about a specific best practice',
          inputSchema: {
            type: 'object' as const,
            properties: {
              id: {
                type: 'string',
                description: 'Practice ID',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'list_practices',
          description: 'List best practices for a workflow type or category',
          inputSchema: {
            type: 'object' as const,
            properties: {
              workflow: {
                type: 'string',
                description:
                  'Optional workflow type (r-script, quarto, shiny, package, etc.)',
              },
              category: {
                type: 'string',
                description:
                  'Optional category (structure, naming, documentation, etc.)',
              },
            },
          },
        },
        {
          name: 'generate_template',
          description: 'Generate a project template for a specific R workflow',
          inputSchema: {
            type: 'object' as const,
            properties: {
              workflow: {
                type: 'string',
                description:
                  'Workflow type (r-script, quarto, shiny, package, rmarkdown, renv, targets, plumber, analysis)',
              },
              projectName: {
                type: 'string',
                description: 'Optional name for the project',
              },
              authorName: {
                type: 'string',
                description: 'Optional author name',
              },
              authorEmail: {
                type: 'string',
                description: 'Optional author email',
              },
            },
            required: ['workflow'],
          },
        },
        {
          name: 'analyze_complexity',
          description: 'Analyze code complexity metrics of an R project',
          inputSchema: {
            type: 'object' as const,
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to analyze',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'analyze_dependencies',
          description: 'Analyze project dependencies and package usage',
          inputSchema: {
            type: 'object' as const,
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to analyze',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'analyze_performance',
          description: 'Analyze performance issues and optimization opportunities',
          inputSchema: {
            type: 'object' as const,
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to analyze',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'apply_custom_rules',
          description: 'Apply custom rules to a project',
          inputSchema: {
            type: 'object' as const,
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to analyze',
              },
              workflow: {
                type: 'string',
                description: 'Optional workflow type',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'get_fix_suggestion',
          description: 'Get automated fix suggestion for a finding',
          inputSchema: {
            type: 'object' as const,
            properties: {
              findingId: {
                type: 'string',
                description: 'Finding ID to get fix for',
              },
              filePath: {
                type: 'string',
                description: 'Path to the file with the finding',
              },
              lineNumber: {
                type: 'number',
                description: 'Optional line number of the finding',
              },
            },
            required: ['findingId', 'filePath'],
          },
        },
      ],
    };
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
        case 'analyze_complexity':
          result = await this.analyzeComplexity(args);
          break;
        case 'analyze_dependencies':
          result = await this.analyzeDependencies(args);
          break;
        case 'analyze_performance':
          result = await this.analyzePerformance(args);
          break;
        case 'apply_custom_rules':
          result = await this.applyCustomRules(args);
          break;
        case 'get_fix_suggestion':
          result = await this.getFixSuggestion(args);
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
    const result = await this.validator.validateProject(path, workflow as any);

    return {
      error: false,
      data: result,
      timestamp: Date.now(),
    };
  }

  private async validateFile(args: Record<string, unknown>): Promise<unknown> {
    const path = args.path as string;

    const exists = await FileUtils.exists(path);
    if (!exists) {
      return {
        error: true,
        code: 'FILE_NOT_FOUND',
        message: `File not found: ${path}`,
      };
    }

    // Validate file
    const findings = await this.validator.validateFile(path);

    return {
      error: false,
      data: {
        path,
        findings,
      },
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
    const workflow = args.workflow as string | undefined;
    const category = args.category as string | undefined;

    const result = kb.listPractices({
      workflow: workflow as any,
      category: category as any,
    });

    return {
      error: false,
      data: result,
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

  private async analyzeComplexity(args: Record<string, unknown>): Promise<unknown> {
    const path = args.path as string;

    const exists = await FileUtils.isDirectory(path);
    if (!exists) {
      return {
        error: true,
        code: 'PATH_NOT_FOUND',
        message: `Directory not found: ${path}`,
      };
    }

    try {
      const result = await this.complexityAnalyzer.analyzeProject(path);
      return {
        error: false,
        data: result,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Error analyzing complexity for ${path}`, error);
      return {
        error: true,
        code: 'ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async analyzeDependencies(args: Record<string, unknown>): Promise<unknown> {
    const path = args.path as string;

    const exists = await FileUtils.isDirectory(path);
    if (!exists) {
      return {
        error: true,
        code: 'PATH_NOT_FOUND',
        message: `Directory not found: ${path}`,
      };
    }

    try {
      const result = await this.dependencyAnalyzer.analyzeProject(path);
      return {
        error: false,
        data: result,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Error analyzing dependencies for ${path}`, error);
      return {
        error: true,
        code: 'ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async analyzePerformance(args: Record<string, unknown>): Promise<unknown> {
    const path = args.path as string;

    const exists = await FileUtils.isDirectory(path);
    if (!exists) {
      return {
        error: true,
        code: 'PATH_NOT_FOUND',
        message: `Directory not found: ${path}`,
      };
    }

    try {
      const result = await this.performanceAnalyzer.analyzeProject(path);
      return {
        error: false,
        data: result,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Error analyzing performance for ${path}`, error);
      return {
        error: true,
        code: 'ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async applyCustomRules(args: Record<string, unknown>): Promise<unknown> {
    const path = args.path as string;
    const workflow = args.workflow as string | undefined;

    const exists = await FileUtils.isDirectory(path);
    if (!exists) {
      return {
        error: true,
        code: 'PATH_NOT_FOUND',
        message: `Directory not found: ${path}`,
      };
    }

    try {
      await this.ruleEngine.loadCustomRules(path);
      const rFiles = await FileUtils.listFiles(path, '**/*.R', true);
      const violations: any[] = [];

      for (const file of rFiles) {
        const content = await FileUtils.readFile(file);
        const fileViolations = await this.ruleEngine.applyRules(file, content, workflow);
        violations.push(...fileViolations);
      }

      return {
        error: false,
        data: {
          totalViolations: violations.length,
          violations,
          rules: this.ruleEngine.getRules(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Error applying custom rules for ${path}`, error);
      return {
        error: true,
        code: 'ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getFixSuggestion(args: Record<string, unknown>): Promise<unknown> {
    const findingId = args.findingId as string;
    const filePath = args.filePath as string;
    const lineNumber = args.lineNumber as number | undefined;

    const exists = await FileUtils.exists(filePath);
    if (!exists) {
      return {
        error: true,
        code: 'FILE_NOT_FOUND',
        message: `File not found: ${filePath}`,
      };
    }

    try {
      const content = await FileUtils.readFile(filePath);
      const lines = content.split('\n');

      // Create a mock finding object
      const finding = {
        id: findingId,
        severity: 'important' as const,
        category: 'style',
        message: 'Finding to fix',
      };

      const fix = await this.fixer.fixFinding(finding, content, lines);
      const suggestion = this.fixer.generateFixSuggestion(finding);

      return {
        error: false,
        data: {
          findingId,
          fix,
          suggestion,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Error generating fix for ${findingId}`, error);
      return {
        error: true,
        code: 'FIX_ERROR',
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
