import type { Express, Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { metricsCollector } from '../utils/metrics.js';
import { SecurityUtils } from '../utils/security.js';
import type { RouteContext } from './context.js';

/** POST /api/generate-template and /api/v1/generate-template */
export function registerTemplateRoutes(app: Express, ctx: RouteContext): void {
  const handler = async (req: Request, res: Response) => {
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
      const sanitizedAuthorName = authorName ? SecurityUtils.sanitizeInput(authorName) : undefined;
      const sanitizedAuthorEmail = authorEmail
        ? SecurityUtils.sanitizeInput(authorEmail)
        : undefined;

      const result = await ctx.templateGenerator.generate(workflow as any, {
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
  };
  for (const prefix of ['/api', '/api/v1']) app.post(`${prefix}/generate-template`, handler);
}
