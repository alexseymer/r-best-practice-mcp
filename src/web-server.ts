import compression from 'compression';
import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import type { Server } from 'http';
import { WorkflowDetector } from './engine/detector.js';
import { Validator } from './engine/validator.js';
import { TemplateGenerator } from './engine/template-generator.js';
import { logger } from './utils/logger.js';
import { getRuntimeConfig, RuntimeConfig } from './config/runtime.js';
import { metricsCollector } from './utils/metrics.js';
import { RateLimiter } from './utils/rate-limiter.js';
import { parseTrustProxy, proxyMisconfigurationWarning } from './middleware/trust-proxy.js';
import { securityHeaders, noStore } from './middleware/security-headers.js';
import { isStaticAssetPath } from './middleware/static-assets.js';
import { bodyParsers, getMaxBodyBytes } from './middleware/body-limits.js';
import { errorHandler } from './middleware/errors.js';
import { pathGuard } from './middleware/path-guard.js';
import { registerUploadRoutes } from './routes/upload.js';
import type { RouteContext } from './routes/context.js';
import { registerDetectRoutes } from './routes/detect.js';
import { registerOpsRoutes } from './routes/ops.js';
import { registerPracticeRoutes } from './routes/practices.js';
import { registerTemplateRoutes } from './routes/templates.js';
import { registerValidateRoutes } from './routes/validate.js';
import { nodeProjectFs } from './engine/project-fs-node.js';

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
    this.app.disable('x-powered-by');
    this.detector = new WorkflowDetector(nodeProjectFs);
    this.validator = new Validator(nodeProjectFs);
    this.templateGenerator = new TemplateGenerator();
    // 100 requests per 60 seconds per client (req.ip)
    this.rateLimiter = new RateLimiter(
      options.rateLimit?.windowMs ?? 60000,
      options.rateLimit?.maxRequests ?? 100
    );
    // Never trust X-Forwarded-For unless TRUST_PROXY says so
    this.app.set('trust proxy', parseTrustProxy(this.env.TRUST_PROXY));
    this.app.use(proxyMisconfigurationWarning(this.env.TRUST_PROXY, (m) => logger.warn(m)));
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Response headers first so every response (429s and errors included) carries them
    this.app.use(securityHeaders());
    this.app.use(noStore());
    this.app.use(compression());

    // Rate limiting middleware - apply to all routes except /health (monitoring must not use up budget).
    // Mounted before the body parsers so rejected clients cost no parsing work.
    // The self-hosted front-end files (CSS, fonts, icons, Swagger UI) are exempt too, see isStaticAssetPath().
    this.app.use(
      this.rateLimiter.middleware({
        skip: (req) => req.path === '/health' || isStaticAssetPath(req.method, req.path),
      })
    );

    // Body parsing: 1 MB globally (env MAX_BODY_BYTES); LARGE_BODY_ROUTES get their own limit
    this.app.use(bodyParsers(getMaxBodyBytes(this.env)));

    // Serve static files from public directory
    // When running from dist/web-server.js, __dirname = dist, so we go up to root/src/public
    const { publicDir, browserEngineDir } = this.routeContext().paths;
    this.app.use(express.static(publicDir));
    // The browser analyses uploads with the engine compiled to dist/browser-engine (scripts/build-browser-engine.mjs).
    this.app.use(
      '/browser-engine',
      express.static(browserEngineDir, {
        index: false,
        maxAge: '1h',
      })
    );

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

    registerOpsRoutes(this.app, this.routeContext());
  }

  private routeContext(): RouteContext {
    const rootDir = path.join(__dirname, '..');
    return {
      runtime: this.runtime,
      env: this.env,
      detector: this.detector,
      validator: this.validator,
      templateGenerator: this.templateGenerator,
      rateLimiter: this.rateLimiter,
      paths: {
        publicDir: path.join(rootDir, 'src', 'public'),
        browserEngineDir: path.join(rootDir, 'dist', 'browser-engine'),
        swaggerDistDir: path.join(rootDir, 'node_modules', 'swagger-ui-dist'),
      },
    };
  }

  private setupRoutes(): void {
    const ctx = this.routeContext();

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
      pathGuard(ctx.runtime.serverPaths)
    );

    registerDetectRoutes(this.app, ctx);
    registerValidateRoutes(this.app, ctx);
    // Browser uploads (own JSON parser, see LARGE_BODY_ROUTES)
    registerUploadRoutes(this.app, { validator: this.validator, detector: this.detector });
    registerPracticeRoutes(this.app);
    registerTemplateRoutes(this.app, ctx);
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
