import type { Express, Request, Response } from 'express';
import { kb } from '../data/knowledge-base.js';
import { logger } from '../utils/logger.js';
import { metricsCollector } from '../utils/metrics.js';
import { PaginationUtils } from '../utils/pagination.js';
import { parsePracticeFilters } from '../utils/query-params.js';

function sendInvalidParameter(res: Response, code: string, message: string): Response {
  return res.status(400).json({ error: true, code, message });
}

function handleListPractices(req: Request, res: Response, withPagination: boolean): any {
  const startTime = process.hrtime();
  try {
    const options = parsePracticeFilters(req.query as Record<string, unknown>);
    if (!options.ok) {
      return sendInvalidParameter(res, options.code, options.message);
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

/** GET /api/practice/:id, /api/practices (all) and /api/v1/practices (paginated) */
export function registerPracticeRoutes(app: Express): void {
  const getPractice = (req: Request, res: Response) => {
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
  };
  for (const prefix of ['/api', '/api/v1']) app.get(`${prefix}/practice/:id`, getPractice);

  app.get('/api/practices', (req: Request, res: Response) => {
    handleListPractices(req, res, false);
  });
  app.get('/api/v1/practices', (req: Request, res: Response) => {
    handleListPractices(req, res, true);
  });
}
