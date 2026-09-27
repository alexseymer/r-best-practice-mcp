import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { WorkflowDetector } from './engine/detector.js';
import { Validator } from './engine/validator.js';
import { TemplateGenerator } from './engine/template-generator.js';
import { kb } from './data/knowledge-base.js';
import { logger } from './utils/logger.js';
import { FileUtils } from './utils/file.js';
import { metricsCollector } from './utils/metrics.js';
import { SecurityUtils } from './utils/security.js';
import { RateLimiter } from './utils/rate-limiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RPracticesWebServer {
  private app: Express;
  private port: number;
  private detector: WorkflowDetector;
  private validator: Validator;
  private templateGenerator: TemplateGenerator;
  private rateLimiter: RateLimiter;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.detector = new WorkflowDetector();
    this.validator = new Validator();
    this.templateGenerator = new TemplateGenerator();
    this.rateLimiter = new RateLimiter(60000, 100); // 100 requests per 60 seconds per IP
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Rate limiting middleware - apply to all routes
    this.app.use(this.rateLimiter.middleware());

    // Request size validation
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.headers['content-length'];
      if (contentLength && !SecurityUtils.validateBodySize(parseInt(contentLength))) {
        return res.status(413).json({
          error: true,
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body exceeds maximum allowed size (50MB)',
        });
      }
      next();
    });

    // Serve static files from public directory
    // When running from dist/web-server.js, __dirname = dist, so we go up to root/src/public
    const publicPath = path.join(__dirname, '..', 'src', 'public');
    this.app.use(express.static(publicPath));

    // Request logging middleware with performance tracking
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const startHrTime = process.hrtime();

      logger.info(`${req.method} ${req.path}`, { params: req.query });

      // Capture response finish to record metrics
      res.on('finish', () => {
        const hrTime = process.hrtime(startHrTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000; // Convert to ms
        const statusCode = res.statusCode;

        logger.debug(`${req.method} ${req.path} completed`, {
          statusCode,
          duration: `${duration.toFixed(2)}ms`,
        });

        // Record metrics
        metricsCollector.recordRequest(req.path, req.method, statusCode, duration);
      });

      next();
    });

    // Health check with metrics
    this.app.get('/health', (req: Request, res: Response) => {
      const metrics = metricsCollector.getSnapshot();

      res.json({
        status: 'ok',
        service: 'r-best-practices-mcp',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        metrics: {
          uptime: metrics.uptime,
          averageRequestDuration: `${metrics.averageRequestDuration.toFixed(2)}ms`,
          totalRequests: metrics.requests.length,
          operationCounts: metrics.operationCounts,
          errorCounts: metrics.errorCounts,
        },
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', (req: Request, res: Response) => {
      const metrics = metricsCollector.getSnapshot();
      res.json(metrics);
    });

    // Rate limit stats endpoint
    this.app.get('/metrics/rate-limit', (req: Request, res: Response) => {
      const stats = this.rateLimiter.getStats();
      res.json({
        status: 'ok',
        rateLimit: {
          window: '60 seconds',
          maxRequests: 100,
          ...stats,
        },
      });
    });

    // Metrics export endpoints
    this.app.get('/metrics/requests.csv', (req: Request, res: Response) => {
      const csv = metricsCollector.exportRequestsCSV();
      res.type('text/csv');
      res.send(csv);
    });

    this.app.get('/metrics/operations.csv', (req: Request, res: Response) => {
      const csv = metricsCollector.exportOperationsCSV();
      res.type('text/csv');
      res.send(csv);
    });

    // Dashboard route
    this.app.get('/dashboard', (req: Request, res: Response) => {
      const dashboardPath = path.join(__dirname, '..', 'src', 'public', 'dashboard.html');
      res.sendFile(dashboardPath);
    });

    // Index route redirects to dashboard
    this.app.get('/', (req: Request, res: Response) => {
      res.redirect('/dashboard');
    });
  }

  private setupRoutes(): void {
    // Detect workflow
    this.app.post('/api/detect-workflow', async (req: Request, res: Response) => {
      const startTime = process.hrtime();
      try {
        const { path: inputPath } = req.body;
        if (!inputPath) {
          return res.status(400).json({
            error: true,
            code: 'MISSING_PARAMETER',
            message: 'path parameter is required',
          });
        }

        if (!SecurityUtils.isValidFilePath(inputPath)) {
          return res.status(400).json({
            error: true,
            code: 'INVALID_PATH',
            message: 'Invalid path format',
          });
        }

        const result = await this.detector.detect(inputPath);
        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation('detection', duration, true);

        res.json({
          error: false,
          data: result,
          timestamp: Date.now(),
        });
      } catch (error) {
        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation(
          'detection',
          duration,
          false,
          error instanceof Error ? error.message : 'Unknown error',
        );

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
      const startTime = process.hrtime();
      try {
        const { path: inputPath, workflow } = req.body;
        if (!inputPath) {
          return res.status(400).json({
            error: true,
            code: 'MISSING_PARAMETER',
            message: 'path parameter is required',
          });
        }

        if (!SecurityUtils.isValidFilePath(inputPath)) {
          return res.status(400).json({
            error: true,
            code: 'INVALID_PATH',
            message: 'Invalid path format',
          });
        }

        if (workflow && !SecurityUtils.isValidWorkflow(workflow)) {
          return res.status(400).json({
            error: true,
            code: 'INVALID_WORKFLOW',
            message: `Invalid workflow type: ${workflow}`,
          });
        }

        const exists = await FileUtils.isDirectory(inputPath);
        if (!exists) {
          return res.status(404).json({
            error: true,
            code: 'PATH_NOT_FOUND',
            message: `Directory not found: ${inputPath}`,
          });
        }

        // Auto-detect workflow if not specified
        let detectedWorkflow = workflow || 'unknown';
        if (!workflow) {
          const detection = await this.detector.detect(inputPath);
          detectedWorkflow = detection.workflow;
        }

        const result = await this.validator.validateProject(inputPath, detectedWorkflow as any);
        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation('validation', duration, true);

        res.json({
          error: false,
          data: result,
          timestamp: Date.now(),
        });
      } catch (error) {
        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation(
          'validation',
          duration,
          false,
          error instanceof Error ? error.message : 'Unknown error',
        );

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
      const startTime = process.hrtime();
      try {
        const { path: inputPath } = req.body;
        if (!inputPath) {
          return res.status(400).json({
            error: true,
            code: 'MISSING_PARAMETER',
            message: 'path parameter is required',
          });
        }

        if (!SecurityUtils.isValidFilePath(inputPath)) {
          return res.status(400).json({
            error: true,
            code: 'INVALID_PATH',
            message: 'Invalid path format',
          });
        }

        const exists = await FileUtils.exists(inputPath);
        if (!exists) {
          return res.status(404).json({
            error: true,
            code: 'FILE_NOT_FOUND',
            message: `File not found: ${inputPath}`,
          });
        }

        const findings = await this.validator.validateFile(inputPath);
        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation('validation', duration, true);

        res.json({
          error: false,
          data: {
            path,
            findings,
          },
          timestamp: Date.now(),
        });
      } catch (error) {
        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation(
          'validation',
          duration,
          false,
          error instanceof Error ? error.message : 'Unknown error',
        );

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
      const startTime = process.hrtime();
      try {
        const { id } = req.params;
        const practice = kb.getPractice(id);
        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation('practice-lookup', duration, !!practice);

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
        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation(
          'practice-lookup',
          duration,
          false,
          error instanceof Error ? error.message : 'Unknown error',
        );

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
      const startTime = process.hrtime();
      try {
        let { workflow, category } = req.query;

        // Validate workflow if provided
        if (workflow && !SecurityUtils.isValidWorkflow(workflow as string)) {
          return res.status(400).json({
            error: true,
            code: 'INVALID_WORKFLOW',
            message: `Invalid workflow type: ${workflow}`,
          });
        }

        // Sanitize category if provided
        if (category && typeof category === 'string') {
          category = SecurityUtils.sanitizeInput(category);
        }

        const result = kb.listPractices({
          workflow: workflow as any,
          category: category as any,
        });

        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation('practice-lookup', duration, true);

        res.json({
          error: false,
          data: result,
          timestamp: Date.now(),
        });
      } catch (error) {
        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation(
          'practice-lookup',
          duration,
          false,
          error instanceof Error ? error.message : 'Unknown error',
        );

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
      const startTime = process.hrtime();
      try {
        const { workflow, projectName, authorName, authorEmail } = req.body;

        if (!workflow) {
          return res.status(400).json({
            error: true,
            code: 'MISSING_PARAMETER',
            message: 'workflow parameter is required',
          });
        }

        if (!SecurityUtils.isValidWorkflow(workflow)) {
          return res.status(400).json({
            error: true,
            code: 'INVALID_WORKFLOW',
            message: `Invalid workflow type: ${workflow}`,
          });
        }

        // Sanitize optional string inputs
        const sanitizedProjectName = projectName ? SecurityUtils.sanitizeInput(projectName) : undefined;
        const sanitizedAuthorName = authorName ? SecurityUtils.sanitizeInput(authorName) : undefined;
        const sanitizedAuthorEmail = authorEmail ? SecurityUtils.sanitizeInput(authorEmail) : undefined;

        const result = await this.templateGenerator.generate(workflow as any, {
          projectName: sanitizedProjectName,
          authorName: sanitizedAuthorName,
          authorEmail: sanitizedAuthorEmail,
        });

        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation('template-generation', duration, true);

        res.json({
          error: false,
          data: result,
          timestamp: Date.now(),
        });
      } catch (error) {
        const hrTime = process.hrtime(startTime);
        const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
        metricsCollector.recordOperation(
          'template-generation',
          duration,
          false,
          error instanceof Error ? error.message : 'Unknown error',
        );

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
        logger.info(`Dashboard available at http://localhost:${this.port}/dashboard`);
        logger.info(`API documentation available at http://localhost:${this.port}/api/tools`);
        logger.info(`Health check available at http://localhost:${this.port}/health`);
        logger.info(`Metrics available at http://localhost:${this.port}/metrics`);
        resolve();
      });
    });
  }
}
