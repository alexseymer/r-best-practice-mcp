import type { Express, Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { metricsCollector } from '../utils/metrics.js';
import { SecurityUtils } from '../utils/security.js';
import { getConfinedPath } from '../middleware/path-guard.js';
import type { RouteContext } from './context.js';

/** POST /api/detect-workflow and /api/v1/detect-workflow */
export function registerDetectRoutes(app: Express, ctx: RouteContext): void {
  const handler = async (req: Request, res: Response) => {
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

      const result = await ctx.detector.detect(getConfinedPath(res, inputPath));
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
  };
  for (const prefix of ['/api', '/api/v1']) app.post(`${prefix}/detect-workflow`, handler);
}
