export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export class PaginationUtils {
  static DEFAULT_LIMIT = 50;
  static MAX_LIMIT = 100;
  static MIN_LIMIT = 1;

  /**
   * Parse and validate pagination parameters from query string
   */
  static parsePaginationParams(query: any): PaginationParams {
    let limit = this.DEFAULT_LIMIT;
    let offset = 0;

    if (query.limit) {
      const parsedLimit = parseInt(query.limit as string, 10);
      if (!isNaN(parsedLimit)) {
        limit = Math.min(Math.max(parsedLimit, this.MIN_LIMIT), this.MAX_LIMIT);
      }
    }

    if (query.offset) {
      const parsedOffset = parseInt(query.offset as string, 10);
      if (!isNaN(parsedOffset) && parsedOffset >= 0) {
        offset = parsedOffset;
      }
    }

    return { limit, offset };
  }

  /**
   * Create a paginated response with metadata
   */
  static createResponse<T>(items: T[], total: number, limit: number, offset: number): PaginatedResponse<T> {
    return {
      data: items,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Paginate an array
   */
  static paginate<T>(items: T[], limit: number, offset: number): T[] {
    return items.slice(offset, offset + limit);
  }

  /**
   * Validate pagination parameters
   */
  static validateParams(limit: number, offset: number): boolean {
    return limit >= this.MIN_LIMIT && limit <= this.MAX_LIMIT && offset >= 0;
  }

  /**
   * Generate pagination headers for response
   */
  static getPaginationHeaders(total: number, limit: number, offset: number): Record<string, string> {
    return {
      'X-Total-Count': total.toString(),
      'X-Pagination-Limit': limit.toString(),
      'X-Pagination-Offset': offset.toString(),
      'X-Pagination-Has-More': (offset + limit < total).toString(),
    };
  }
}
