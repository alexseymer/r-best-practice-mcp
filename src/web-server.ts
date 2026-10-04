import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import type { Server } from 'http';
import { WorkflowDetector } from './engine/detector.js';
import { Validator } from './engine/validator.js';
import { TemplateGenerator } from './engine/template-generator.js';
import { kb } from './data/knowledge-base.js';
import { logger } from './utils/logger.js';
import { getRuntimeConfig, RuntimeConfig } from './config/runtime.js';
import { FileUtils } from './utils/file.js';
import { metricsCollector } from './utils/metrics.js';
import { SecurityUtils } from './utils/security.js';
import { RateLimiter } from './utils/rate-limiter.js';
import { OpenAPIGenerator } from './utils/openapi.js';
import { PaginationUtils } from './utils/pagination.js';
import { toRestToolsPayload } from './tools/schemas.js';
import { parseTrustProxy } from './middleware/trust-proxy.js';
import { pathGuard, getConfinedPath } from './middleware/path-guard.js';
import { errorHandler } from './middleware/errors.js';
import { parseFindingFilters, parsePracticeFilters } from './utils/query-params.js';

if (typeof __dirname === 'undefined') {
  (global as any).__dirname = path.join(process.cwd(), 'src');
}

export interface WebServerOptions {
  env?: NodeJS.ProcessEnv;
  /** Override the per-client rate limit (default 100 requests per 60 s). */
  rateLimit?: { windowMs: number; maxRequests: number };
}

export class RPracticesWebServer {
  private app: Express;
  private port: number;
  private detector: WorkflowDetector;
  private validator: Validator;
  private templateGenerator: TemplateGenerator;
  private rateLimiter: RateLimiter;
  private httpServer?: Server;
  private env: NodeJS.ProcessEnv;
  private runtime: RuntimeConfig;

  /** `options.env` replaces `process.env` for deployment settings (used by tests). */
  constructor(port: number = 3000, options: WebServerOptions = {}) {
    this.port = port;
    this.env = options.env ?? process.env;
    this.runtime = getRuntimeConfig(this.env);
    this.app = express();
    this.detector = new WorkflowDetector();
    this.validator = new Validator();
    this.templateGenerator = new TemplateGenerator();
    // 100 requests per 60 seconds per client (req.ip)
    this.rateLimiter = new RateLimiter(
      options.rateLimit?.windowMs ?? 60000,
      options.rateLimit?.maxRequests ?? 100
    );
    // Never trust X-Forwarded-For unless TRUST_PROXY says so
    this.app.set('trust proxy', parseTrustProxy(this.env.TRUST_PROXY));
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Rate limiting middleware - apply to all routes except /health (monitoring must not use up budget)
    this.app.use(this.rateLimiter.middleware({ skip: (req) => req.path === '/health' }));

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

    // Deployment-dependent settings the dashboard adapts to
    this.app.get('/api/config', (req: Request, res: Response) => {
      res.json({ error: false, data: this.runtime, timestamp: Date.now() });
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

    // OpenAPI spec endpoint
    this.app.get('/openapi.json', (req: Request, res: Response) => {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const spec = OpenAPIGenerator.generateSpec('0.2.0', baseUrl);
      res.json(spec);
    });

    // OpenAPI UI (Swagger UI) - simple HTML redirect
    this.app.get('/api-docs', (req: Request, res: Response) => {
      const swaggerUrl = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@3';
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>R Best Practices MCP - API Documentation</title>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="${swaggerUrl}/swagger-ui.css">
          </head>
          <body>
            <div id="swagger-ui"></div>
            <script src="${swaggerUrl}/swagger-ui-bundle.js"></script>
            <script>
              window.onload = function() {
                const ui = SwaggerUIBundle({
                  url: window.location.origin + '/openapi.json',
                  dom_id: '#swagger-ui',
                  presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                  ],
                  layout: "BaseLayout"
                })
              }
            </script>
          </body>
        </html>
      `);
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
    // Confine client-supplied paths to the allowed roots (no-op in unrestricted mode)
    this.app.post(
      [
        '/api/detect-workflow',
        '/api/v1/detect-workflow',
        '/api/validate-project',
        '/api/v1/validate-project',
        '/api/validate-file',
        '/api/v1/validate-file',
      ],
      pathGuard(this.runtime.serverPaths)
    );

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

        const result = await this.detector.detect(getConfinedPath(res, inputPath));
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
          error instanceof Error ? error.message : 'Unknown error'
        );

        logger.error('Error in detect-workflow', error);
        res.status(500).json({
          error: true,
          code: 'DETECTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Validate project and file (v0 + v1 share one implementation)
    for (const prefix of ['/api', '/api/v1']) {
      this.app.post(`${prefix}/validate-project`, (req: Request, res: Response) =>
        this.handleValidateProject(req, res)
      );
      this.app.post(`${prefix}/validate-file`, (req: Request, res: Response) =>
        this.handleValidateFile(req, res)
      );
    }

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
          error instanceof Error ? error.message : 'Unknown error'
        );

        logger.error('Error in get-practice', error);
        res.status(500).json({
          error: true,
          code: 'PRACTICE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // List practices (v0 - backward compatible)
    this.app.get('/api/practices', (req: Request, res: Response) => {
      this.handleListPractices(req, res, false);
    });

    // List practices (v1 - with pagination)
    this.app.get('/api/v1/practices', (req: Request, res: Response) => {
      this.handleListPractices(req, res, true);
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
        const sanitizedProjectName = projectName
          ? SecurityUtils.sanitizeInput(projectName)
          : undefined;
        const sanitizedAuthorName = authorName
          ? SecurityUtils.sanitizeInput(authorName)
          : undefined;
        const sanitizedAuthorEmail = authorEmail
          ? SecurityUtils.sanitizeInput(authorEmail)
          : undefined;

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
          error instanceof Error ? error.message : 'Unknown error'
        );

        logger.error('Error in generate-template', error);
        res.status(500).json({
          error: true,
          code: 'TEMPLATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // === API v1 Routes (with versioning) ===
    // Detect workflow (v1)
    this.app.post('/api/v1/detect-workflow', async (req: Request, res: Response) => {
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

        const result = await this.detector.detect(getConfinedPath(res, inputPath));
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
          error instanceof Error ? error.message : 'Unknown error'
        );

        logger.error('Error in detect-workflow', error);
        res.status(500).json({
          error: true,
          code: 'DETECTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get practice (v1)
    this.app.get('/api/v1/practice/:id', (req: Request, res: Response) => {
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
          error instanceof Error ? error.message : 'Unknown error'
        );

        logger.error('Error in get-practice', error);
        res.status(500).json({
          error: true,
          code: 'PRACTICE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Generate template (v1)
    this.app.post('/api/v1/generate-template', async (req: Request, res: Response) => {
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

        const sanitizedProjectName = projectName
          ? SecurityUtils.sanitizeInput(projectName)
          : undefined;
        const sanitizedAuthorName = authorName
          ? SecurityUtils.sanitizeInput(authorName)
          : undefined;
        const sanitizedAuthorEmail = authorEmail
          ? SecurityUtils.sanitizeInput(authorEmail)
          : undefined;

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
          error instanceof Error ? error.message : 'Unknown error'
        );

        logger.error('Error in generate-template', error);
        res.status(500).json({
          error: true,
          code: 'TEMPLATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // List all tools (for introspection); derived from tools/schemas.ts like the MCP tool list
    this.app.get('/api/tools', (req: Request, res: Response) => {
      res.json({
        error: false,
        data: toRestToolsPayload(),
        timestamp: Date.now(),
      });
    });
  }

  private sendInvalidParameter(res: Response, code: string, message: string): Response {
    return res.status(400).json({ error: true, code, message });
  }

  private async handleValidateProject(req: Request, res: Response): Promise<void> {
    const startTime = process.hrtime();
    try {
      const body = req.body ?? {};
      const { path: inputPath, workflow } = body;
      if (!inputPath) {
        this.sendInvalidParameter(res, 'MISSING_PARAMETER', 'path parameter is required');
        return;
      }

      if (!SecurityUtils.isValidFilePath(inputPath)) {
        this.sendInvalidParameter(res, 'INVALID_PATH', 'Invalid path format');
        return;
      }

      if (workflow && !SecurityUtils.isValidWorkflow(workflow)) {
        this.sendInvalidParameter(res, 'INVALID_WORKFLOW', `Invalid workflow type: ${workflow}`);
        return;
      }

      const filters = parseFindingFilters(body);
      if (!filters.ok) {
        this.sendInvalidParameter(res, filters.code, filters.message);
        return;
      }

      const targetPath = getConfinedPath(res, inputPath);
      const exists = await FileUtils.isDirectory(targetPath);
      if (!exists) {
        res.status(404).json({
          error: true,
          code: 'PATH_NOT_FOUND',
          message: `Directory not found: ${inputPath}`,
        });
        return;
      }

      // Auto-detect workflow if not specified
      let detectedWorkflow = workflow || 'unknown';
      if (!workflow) {
        const detection = await this.detector.detect(targetPath);
        detectedWorkflow = detection.workflow;
      }

      const result = await this.validator.validateProject(
        targetPath,
        detectedWorkflow as any,
        filters.value
      );
      const hrTime = process.hrtime(startTime);
      const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
      metricsCollector.recordOperation('validation', duration, true);

      res.json({
        error: false,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.sendValidationFailure(res, startTime, error, 'validate-project');
    }
  }

  private async handleValidateFile(req: Request, res: Response): Promise<void> {
    const startTime = process.hrtime();
    try {
      const body = req.body ?? {};
      const { path: inputPath } = body;
      if (!inputPath) {
        this.sendInvalidParameter(res, 'MISSING_PARAMETER', 'path parameter is required');
        return;
      }

      if (!SecurityUtils.isValidFilePath(inputPath)) {
        this.sendInvalidParameter(res, 'INVALID_PATH', 'Invalid path format');
        return;
      }

      const filters = parseFindingFilters(body);
      if (!filters.ok) {
        this.sendInvalidParameter(res, filters.code, filters.message);
        return;
      }

      const targetPath = getConfinedPath(res, inputPath);
      const exists = await FileUtils.exists(targetPath);
      if (!exists) {
        res.status(404).json({
          error: true,
          code: 'FILE_NOT_FOUND',
          message: `File not found: ${inputPath}`,
        });
        return;
      }

      const data = await this.validator.validateFileWithSummary(targetPath, filters.value);
      const hrTime = process.hrtime(startTime);
      const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
      metricsCollector.recordOperation('validation', duration, true);

      res.json({
        error: false,
        data,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.sendValidationFailure(res, startTime, error, 'validate-file');
    }
  }

  private sendValidationFailure(
    res: Response,
    startTime: [number, number],
    error: unknown,
    route: string
  ): void {
    const hrTime = process.hrtime(startTime);
    const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
    metricsCollector.recordOperation(
      'validation',
      duration,
      false,
      error instanceof Error ? error.message : 'Unknown error'
    );

    logger.error(`Error in ${route}`, error);
    res.status(500).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  private handleListPractices(req: Request, res: Response, withPagination: boolean): any {
    const startTime = process.hrtime();
    try {
      const options = parsePracticeFilters(req.query as Record<string, unknown>);
      if (!options.ok) {
        return this.sendInvalidParameter(res, options.code, options.message);
      }

      // On v1 `limit` is the page size (handled by pagination below), so the filter limit is
      // only applied to the unpaginated v0 response.
      const filterOptions = { ...options.value };
      if (withPagination) delete filterOptions.limit;
      const result = kb.listPractices(filterOptions);

      const hrTime = process.hrtime(startTime);
      const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
      metricsCollector.recordOperation('practice-lookup', duration, true);

      if (withPagination) {
        const paginationParams = PaginationUtils.parsePaginationParams(req.query);
        const paginatedData = PaginationUtils.paginate(
          result.practices,
          paginationParams.limit,
          paginationParams.offset
        );
        const paginatedResponse = PaginationUtils.createResponse(
          paginatedData,
          result.practices.length,
          paginationParams.limit,
          paginationParams.offset
        );

        res.json({
          error: false,
          data: paginatedResponse.data,
          pagination: paginatedResponse.pagination,
          timestamp: Date.now(),
        });
      } else {
        res.json({
          error: false,
          data: result,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      const hrTime = process.hrtime(startTime);
      const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
      metricsCollector.recordOperation(
        'practice-lookup',
        duration,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );

      logger.error('Error in list-practices', error);
      res.status(500).json({
        error: true,
        code: 'PRACTICES_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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

    // Error handler (status-aware: malformed JSON -> 400, oversized body -> 413, ...)
    this.app.use(errorHandler);
  }

  /** Port the server is actually listening on (useful when constructed with port 0). */
  listeningPort(): number | undefined {
    const address = this.httpServer?.address();
    return address && typeof address === 'object' ? address.port : undefined;
  }

  async stop(): Promise<void> {
    this.rateLimiter.stop();
    const server = this.httpServer;
    this.httpServer = undefined;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = this.app.listen(this.port, '0.0.0.0', () => {
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
