/**
 * POST /api/validate-upload: validate (or just detect) a project posted from the browser.
 * REST only: it needs the browser, so it is not an MCP tool.
 */
import express, { Express, NextFunction, Request, Response } from 'express';
import { LARGE_BODY_ROUTES } from '../config/runtime.js';
import { WorkflowDetector } from '../engine/detector.js';
import {
  sanitizeUpload,
  stripDirPrefix,
  UPLOAD_LABEL,
  UploadError,
  UploadGate,
  UploadLimits,
  withUploadedProject,
} from '../engine/upload.js';
import { Validator } from '../engine/validator.js';
import { Workflow } from '../types/workflow.js';
import { logger } from '../utils/logger.js';
import { metricsCollector } from '../utils/metrics.js';
import { parseFindingFilters } from '../utils/query-params.js';
import { SecurityUtils } from '../utils/security.js';

export const UPLOAD_ROUTE = '/api/validate-upload';

export interface UploadRouteDeps {
  validator: Validator;
  detector: WorkflowDetector;
  /** Override for tests. */
  limits?: UploadLimits;
  gate?: UploadGate;
}

function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: true, code, message });
}

/** Maps body-parser errors (too large, malformed JSON) to the API's error shape. */
function parseJsonBody(limitBytes: number) {
  const parser = express.json({ limit: limitBytes });
  return (req: Request, res: Response, next: NextFunction): void => {
    parser(req, res, (err?: unknown) => {
      if (!err) return next();
      const e = err as { type?: string; status?: number };
      if (e.type === 'entity.too.large') {
        return sendError(
          res,
          413,
          'PAYLOAD_TOO_LARGE',
          `Request body exceeds ${Math.round(limitBytes / (1024 * 1024))} MB`
        );
      }
      if (e.type === 'entity.parse.failed' || e.status === 400) {
        return sendError(res, 400, 'INVALID_PARAMETER', 'Request body is not valid JSON');
      }
      return next(err);
    });
  };
}

export function registerUploadRoutes(app: Express, deps: UploadRouteDeps): void {
  const gate = deps.gate ?? new UploadGate();
  const limitBytes = LARGE_BODY_ROUTES[UPLOAD_ROUTE];

  app.post(UPLOAD_ROUTE, parseJsonBody(limitBytes), async (req: Request, res: Response) => {
    const startTime = process.hrtime();
    const elapsedMs = (): number => {
      const t = process.hrtime(startTime);
      return t[0] * 1000 + t[1] / 1e6;
    };
    res.setHeader('Cache-Control', 'no-store');
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const upload = sanitizeUpload(body, deps.limits);

      const workflow = body.workflow;
      if (workflow !== undefined && workflow !== null && workflow !== '') {
        if (typeof workflow !== 'string' || !SecurityUtils.isValidWorkflow(workflow)) {
          return sendError(res, 400, 'INVALID_WORKFLOW', 'Invalid workflow type');
        }
      }
      const filters = parseFindingFilters(body);
      if (!filters.ok) return sendError(res, 400, filters.code, filters.message);
      const detectOnly = body.detectOnly === true;

      const release = await gate.acquire();
      let data: Record<string, unknown>;
      try {
        data = await withUploadedProject(upload.files, async (dir, createdDir) => {
          const scrub = <T>(v: T): T => stripDirPrefix(v, [dir, createdDir]);
          const detection = await deps.detector.detect(dir);
          const detected = scrub({
            workflow: detection.workflow,
            confidence: detection.confidence,
            indicators: detection.indicators,
          });
          const uploadInfo = {
            files: upload.files.length,
            bytes: upload.bytes,
            skipped: upload.skipped,
          };
          if (detectOnly) return { detected, upload: uploadInfo };

          const chosen = (
            typeof workflow === 'string' && workflow ? workflow : detection.workflow
          ) as Workflow;
          const result = await deps.validator.validateProject(dir, chosen, filters.value);
          return {
            ...scrub(result),
            filePath: UPLOAD_LABEL,
            detected,
            upload: uploadInfo,
          };
        });
      } finally {
        release();
      }

      metricsCollector.recordOperation('validation', elapsedMs(), true);
      res.json({ error: false, data, timestamp: Date.now() });
    } catch (error) {
      if (error instanceof UploadError) {
        if (error.code === 'BUSY') res.setHeader('Retry-After', '5');
        return sendError(res, error.status, error.code, error.message);
      }
      metricsCollector.recordOperation(
        'validation',
        elapsedMs(),
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
      logger.error('Error in validate-upload', error);
      sendError(res, 500, 'VALIDATION_ERROR', 'The uploaded project could not be analysed');
    }
  });
}

/** OpenAPI path item for the upload endpoint (not an MCP tool, so not part of TOOL_DEFS). */
export function buildUploadOpenApiPaths(): Record<string, unknown> {
  const problem = (description: string) => ({ description });
  return {
    [UPLOAD_ROUTE]: {
      post: {
        summary: 'Validate an uploaded project',
        description:
          'Validates a project posted as a list of text files (for browsers, which cannot give the server a path). ' +
          'The files are written to a private temporary directory, analysed and deleted immediately; nothing is stored. ' +
          'Unsupported files are skipped. Limits are published by GET /api/config (upload). REST only, not an MCP tool.',
        operationId: 'validateUpload',
        tags: ['Validation'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['files'],
                properties: {
                  files: {
                    type: 'array',
                    description: 'Project files; paths are relative to the project root',
                    items: {
                      type: 'object',
                      required: ['path', 'content'],
                      properties: {
                        path: { type: 'string', example: 'R/utils.R' },
                        content: { type: 'string' },
                      },
                    },
                  },
                  workflow: { type: 'string', description: 'Workflow type; detected when omitted' },
                  minSeverity: {
                    type: 'string',
                    enum: ['critical', 'important', 'recommended', 'info'],
                  },
                  categories: { type: 'array', items: { type: 'string' } },
                  maxFindings: { type: 'integer', minimum: 1, maximum: 1000 },
                  detectOnly: {
                    type: 'boolean',
                    description:
                      'Only detect the workflow; the response has detected and upload, no findings',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              'ValidationResult fields plus detected { workflow, confidence, indicators } and upload { files, bytes, skipped }',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ValidationResult' } },
            },
          },
          400: problem('Invalid files or parameters (code INVALID_PARAMETER, INVALID_WORKFLOW)'),
          413: problem('Upload too large (code PAYLOAD_TOO_LARGE)'),
          503: problem('Server busy (code BUSY); see the Retry-After header'),
        },
      },
    },
  };
}
