import type { Express, Request, Response } from 'express';
import { FileUtils } from '../utils/file.js';
import { logger } from '../utils/logger.js';
import { metricsCollector } from '../utils/metrics.js';
import { SecurityUtils } from '../utils/security.js';
import { parseFindingFilters } from '../utils/query-params.js';
import { getConfinedPath } from '../middleware/path-guard.js';
import type { RouteContext } from './context.js';

function sendInvalidParameter(res: Response, code: string, message: string): Response {
  return res.status(400).json({ error: true, code, message });
}

async function handleValidateProject(
  ctx: RouteContext,
  req: Request,
  res: Response
): Promise<void> {
  const startTime = process.hrtime();
  try {
    const body = req.body ?? {};
    const { path: inputPath, workflow } = body;
    if (!inputPath) {
      sendInvalidParameter(res, 'MISSING_PARAMETER', 'path parameter is required');
      return;
    }

    if (!SecurityUtils.isValidFilePath(inputPath)) {
      sendInvalidParameter(res, 'INVALID_PATH', 'Invalid path format');
      return;
    }

    if (workflow && !SecurityUtils.isValidWorkflow(workflow)) {
      sendInvalidParameter(res, 'INVALID_WORKFLOW', `Invalid workflow type: ${workflow}`);
      return;
    }

    const filters = parseFindingFilters(body);
    if (!filters.ok) {
      sendInvalidParameter(res, filters.code, filters.message);
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
      const detection = await ctx.detector.detect(targetPath);
      detectedWorkflow = detection.workflow;
    }

    const result = await ctx.validator.validateProject(
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
    sendValidationFailure(res, startTime, error, 'validate-project');
  }
}

async function handleValidateFile(ctx: RouteContext, req: Request, res: Response): Promise<void> {
  const startTime = process.hrtime();
  try {
    const body = req.body ?? {};
    const { path: inputPath } = body;
    if (!inputPath) {
      sendInvalidParameter(res, 'MISSING_PARAMETER', 'path parameter is required');
      return;
    }

    if (!SecurityUtils.isValidFilePath(inputPath)) {
      sendInvalidParameter(res, 'INVALID_PATH', 'Invalid path format');
      return;
    }

    const filters = parseFindingFilters(body);
    if (!filters.ok) {
      sendInvalidParameter(res, filters.code, filters.message);
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

    const data = await ctx.validator.validateFileWithSummary(targetPath, filters.value);
    const hrTime = process.hrtime(startTime);
    const duration = hrTime[0] * 1000 + hrTime[1] / 1000000;
    metricsCollector.recordOperation('validation', duration, true);

    res.json({
      error: false,
      data,
      timestamp: Date.now(),
    });
  } catch (error) {
    sendValidationFailure(res, startTime, error, 'validate-file');
  }
}

function sendValidationFailure(
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

/** POST /api/validate-project, /api/validate-file and their /api/v1 twins */
export function registerValidateRoutes(app: Express, ctx: RouteContext): void {
  for (const prefix of ['/api', '/api/v1']) {
    app.post(`${prefix}/validate-project`, (req: Request, res: Response) =>
      handleValidateProject(ctx, req, res)
    );
    app.post(`${prefix}/validate-file`, (req: Request, res: Response) =>
      handleValidateFile(ctx, req, res)
    );
  }
}
