import path from 'path';
import type { Express, Request, Response } from 'express';
import { metricsCollector } from '../utils/metrics.js';
import { OpenAPIGenerator } from '../utils/openapi.js';
import { toRestToolsPayload } from '../tools/schemas.js';
import { metricsAccess } from '../middleware/metrics-access.js';
import type { RouteContext } from './context.js';

/** Service endpoints: health, config, metrics, OpenAPI, dashboard, tool list and redirects. */
export function registerOpsRoutes(app: Express, ctx: RouteContext): void {
  // Health check with metrics
  app.get('/health', (req: Request, res: Response) => {
    const metrics = metricsCollector.getSnapshot();

    res.json({
      status: 'ok',
      service: 'r-best-practices-mcp',
      version: ctx.runtime.version,
      build: ctx.runtime.build,
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
  app.get('/api/config', (req: Request, res: Response) => {
    res.json({ error: false, data: ctx.runtime, timestamp: Date.now() });
  });

  // /metrics*: public, bearer-token protected or disabled (404), see getRuntimeConfig().metrics
  app.use('/metrics', metricsAccess(ctx.runtime.metrics, ctx.env.METRICS_TOKEN));

  // Metrics endpoint
  app.get('/metrics', (req: Request, res: Response) => {
    const metrics = metricsCollector.getSnapshot();
    res.json(metrics);
  });

  // Rate limit stats endpoint
  app.get('/metrics/rate-limit', (req: Request, res: Response) => {
    const stats = ctx.rateLimiter.getStats();
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
  app.get('/openapi.json', (req: Request, res: Response) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const spec = OpenAPIGenerator.generateSpec(ctx.runtime.version, baseUrl);
    res.json(spec);
  });

  // OpenAPI UI: Swagger UI served from the pinned swagger-ui-dist package, no CDN
  // (only the two files the page needs are exposed, not the whole package directory)
  const swaggerDist = ctx.paths.swaggerDistDir;
  for (const asset of ['swagger-ui.css', 'swagger-ui-bundle.js']) {
    app.get(`/api-docs/assets/${asset}`, (req: Request, res: Response) => {
      res.sendFile(path.join(swaggerDist, asset));
    });
  }
  app.get('/api-docs', (req: Request, res: Response) => {
    res.sendFile(path.join(ctx.paths.publicDir, 'api-docs.html'));
  });

  // Metrics export endpoints
  app.get('/metrics/requests.csv', (req: Request, res: Response) => {
    const csv = metricsCollector.exportRequestsCSV();
    res.type('text/csv');
    res.send(csv);
  });

  app.get('/metrics/operations.csv', (req: Request, res: Response) => {
    const csv = metricsCollector.exportOperationsCSV();
    res.type('text/csv');
    res.send(csv);
  });

  // Dashboard route
  app.get('/dashboard', (req: Request, res: Response) => {
    const dashboardPath = path.join(ctx.paths.publicDir, 'dashboard.html');
    res.sendFile(dashboardPath);
  });

  // Browsers request /favicon.ico regardless of <link rel=icon>; avoid the JSON 404
  app.get('/favicon.ico', (req: Request, res: Response) => {
    res.redirect(301, '/favicon.svg');
  });

  // Index route redirects to dashboard
  app.get('/', (req: Request, res: Response) => {
    res.redirect('/dashboard');
  });

  // List all tools (for introspection); derived from tools/schemas.ts like the MCP tool list
  app.get('/api/tools', (req: Request, res: Response) => {
    res.json({
      error: false,
      data: toRestToolsPayload(),
      timestamp: Date.now(),
    });
  });
}
