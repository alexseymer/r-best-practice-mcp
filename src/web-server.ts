import express, { Express, Request, Response, NextFunction } from 'express';
import { WorkflowDetector } from './engine/detector.js';
import { Validator } from './engine/validator.js';
import { TemplateGenerator } from './engine/template-generator.js';
import { kb } from './data/knowledge-base.js';
import { logger } from './utils/logger.js';
import { FileUtils } from './utils/file.js';

export class RPracticesWebServer {
  private app: Express;
  private port: number;
  private detector: WorkflowDetector;
  private validator: Validator;
  private templateGenerator: TemplateGenerator;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.detector = new WorkflowDetector();
    this.validator = new Validator();
    this.templateGenerator = new TemplateGenerator();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.path}`, { params: req.query, body: req.body });
      next();
    });

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        service: 'r-best-practices-mcp',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupRoutes(): void {
    // Detect workflow
    this.app.post('/api/detect-workflow', async (req: Request, res: Response) => {
      try {
        const { path } = req.body;
        if (!path) {
          return res.status(400).json({
            error: true,
            code: 'MISSING_PARAMETER',
            message: 'path parameter is required',
          });
        }

        const result = await this.detector.detect(path);
        res.json({
          error: false,
          data: result,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error('Error in detect-workflow', error);
        res.status(500).json({
          error: true,
          code: 'DETECTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Validate project
    this.app.post('/api/validate-project', async (req: Request, res: Response) => {
      try {
        const { path, workflow } = req.body;
        if (!path) {
          return res.status(400).json({
            error: true,
            code: 'MISSING_PARAMETER',
            message: 'path parameter is required',
          });
        }

        const exists = await FileUtils.isDirectory(path);
        if (!exists) {
          return res.status(404).json({
            error: true,
            code: 'PATH_NOT_FOUND',
            message: `Directory not found: ${path}`,
          });
        }

        // Auto-detect workflow if not specified
        let detectedWorkflow = workflow || 'unknown';
        if (!workflow) {
          const detection = await this.detector.detect(path);
          detectedWorkflow = detection.workflow;
        }

        const result = await this.validator.validateProject(path, detectedWorkflow as any);

        res.json({
          error: false,
          data: result,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error('Error in validate-project', error);
        res.status(500).json({
          error: true,
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Validate file
    this.app.post('/api/validate-file', async (req: Request, res: Response) => {
      try {
        const { path } = req.body;
        if (!path) {
          return res.status(400).json({
            error: true,
            code: 'MISSING_PARAMETER',
            message: 'path parameter is required',
          });
        }

        const exists = await FileUtils.exists(path);
        if (!exists) {
          return res.status(404).json({
            error: true,
            code: 'FILE_NOT_FOUND',
            message: `File not found: ${path}`,
          });
        }

        const findings = await this.validator.validateFile(path);

        res.json({
          error: false,
          data: {
            path,
            findings,
          },
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error('Error in validate-file', error);
        res.status(500).json({
          error: true,
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get practice
    this.app.get('/api/practice/:id', (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const practice = kb.getPractice(id);

        if (!practice) {
          return res.status(404).json({
            error: true,
            code: 'NOT_FOUND',
            message: `Practice not found: ${id}`,
          });
        }

        res.json({
          error: false,
          data: practice,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error('Error in get-practice', error);
        res.status(500).json({
          error: true,
          code: 'PRACTICE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // List practices
    this.app.get('/api/practices', (req: Request, res: Response) => {
      try {
        const { workflow, category } = req.query;

        const result = kb.listPractices({
          workflow: workflow as any,
          category: category as any,
        });

        res.json({
          error: false,
          data: result,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error('Error in list-practices', error);
        res.status(500).json({
          error: true,
          code: 'PRACTICES_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Generate template
    this.app.post('/api/generate-template', async (req: Request, res: Response) => {
      try {
        const { workflow, projectName, authorName, authorEmail } = req.body;

        if (!workflow) {
          return res.status(400).json({
            error: true,
            code: 'MISSING_PARAMETER',
            message: 'workflow parameter is required',
          });
        }

        const result = await this.templateGenerator.generate(workflow as any, {
          projectName,
          authorName,
          authorEmail,
        });

        res.json({
          error: false,
          data: result,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error('Error in generate-template', error);
        res.status(500).json({
          error: true,
          code: 'TEMPLATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // List all tools (for introspection)
    this.app.get('/api/tools', (req: Request, res: Response) => {
      res.json({
        error: false,
        data: [
          {
            name: 'detect_workflow',
            method: 'POST',
            path: '/api/detect-workflow',
            description: 'Detect the R workflow type from a directory path',
            parameters: {
              path: { type: 'string', description: 'Directory path to analyze', required: true },
            },
          },
          {
            name: 'validate_project',
            method: 'POST',
            path: '/api/validate-project',
            description: 'Validate an R project against best practices',
            parameters: {
              path: { type: 'string', description: 'Directory path to validate', required: true },
              workflow: { type: 'string', description: 'Optional workflow type', required: false },
            },
          },
          {
            name: 'validate_file',
            method: 'POST',
            path: '/api/validate-file',
            description: 'Validate a single R or Quarto file',
            parameters: {
              path: { type: 'string', description: 'File path to validate', required: true },
            },
          },
          {
            name: 'get_practice',
            method: 'GET',
            path: '/api/practice/:id',
            description: 'Get details about a specific best practice',
            parameters: {
              id: { type: 'string', description: 'Practice ID', required: true },
            },
          },
          {
            name: 'list_practices',
            method: 'GET',
            path: '/api/practices',
            description: 'List best practices for a workflow type or category',
            parameters: {
              workflow: { type: 'string', description: 'Optional workflow type', required: false },
              category: { type: 'string', description: 'Optional category', required: false },
            },
          },
          {
            name: 'generate_template',
            method: 'POST',
            path: '/api/generate-template',
            description: 'Generate a project template for a specific R workflow',
            parameters: {
              workflow: { type: 'string', description: 'Workflow type', required: true },
              projectName: { type: 'string', description: 'Optional project name', required: false },
              authorName: { type: 'string', description: 'Optional author name', required: false },
              authorEmail: { type: 'string', description: 'Optional author email', required: false },
            },
          },
        ],
        timestamp: Date.now(),
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: true,
        code: 'NOT_FOUND',
        message: `Route not found: ${req.method} ${req.path}`,
      });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error', err);
      res.status(500).json({
        error: true,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, '0.0.0.0', () => {
        logger.info(`R Best Practices Web Server running on port ${this.port}`);
        logger.info(`API documentation available at http://localhost:${this.port}/api/tools`);
        logger.info(`Health check available at http://localhost:${this.port}/health`);
        resolve();
      });
    });
  }
}
