import { PaginationUtils } from '../../src/utils/pagination';

describe('PaginationUtils', () => {
  describe('parsePaginationParams', () => {
    it('should return default values for empty query', () => {
      const result = PaginationUtils.parsePaginationParams({});
      expect(result).toEqual({ limit: 50, offset: 0 });
    });

    it('should parse limit from query', () => {
      const result = PaginationUtils.parsePaginationParams({ limit: '25' });
      expect(result.limit).toBe(25);
    });

    it('should parse offset from query', () => {
      const result = PaginationUtils.parsePaginationParams({ offset: '100' });
      expect(result.offset).toBe(100);
    });

    it('should enforce maximum limit of 100', () => {
      const result = PaginationUtils.parsePaginationParams({ limit: '500' });
      expect(result.limit).toBe(100);
    });

    it('should enforce minimum limit of 1', () => {
      const result = PaginationUtils.parsePaginationParams({ limit: '0' });
      expect(result.limit).toBe(1);
    });

    it('should handle negative offset as 0', () => {
      const result = PaginationUtils.parsePaginationParams({ offset: '-10' });
      expect(result.offset).toBe(0);
    });

    it('should ignore invalid limit values', () => {
      const result = PaginationUtils.parsePaginationParams({ limit: 'invalid' });
      expect(result.limit).toBe(50); // Default
    });

    it('should handle both limit and offset', () => {
      const result = PaginationUtils.parsePaginationParams({ limit: '30', offset: '60' });
      expect(result).toEqual({ limit: 30, offset: 60 });
    });
  });

  describe('paginate', () => {
    const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);

    it('should return correct slice', () => {
      const result = PaginationUtils.paginate(items, 10, 0);
      expect(result).toHaveLength(10);
      expect(result[0]).toBe('item-0');
      expect(result[9]).toBe('item-9');
    });

    it('should handle offset', () => {
      const result = PaginationUtils.paginate(items, 10, 20);
      expect(result).toHaveLength(10);
      expect(result[0]).toBe('item-20');
    });

    it('should handle partial last page', () => {
      const result = PaginationUtils.paginate(items, 30, 90);
      expect(result).toHaveLength(10);
    });

    it('should return empty array for offset beyond length', () => {
      const result = PaginationUtils.paginate(items, 10, 1000);
      expect(result).toHaveLength(0);
    });
  });

  describe('createResponse', () => {
    const items = ['a', 'b', 'c'];

    it('should create paginated response', () => {
      const response = PaginationUtils.createResponse(items, 100, 50, 0);
      expect(response.data).toEqual(items);
      expect(response.pagination).toEqual({
        total: 100,
        limit: 50,
        offset: 0,
        hasMore: true,
      });
    });

    it('should indicate hasMore as false on last page', () => {
      const response = PaginationUtils.createResponse(items, 50, 50, 0);
      expect(response.pagination.hasMore).toBe(false);
    });

    it('should indicate hasMore correctly mid-page', () => {
      const response = PaginationUtils.createResponse(items, 100, 10, 50);
      expect(response.pagination.hasMore).toBe(true);
    });
  });

  describe('validateParams', () => {
    it('should validate correct parameters', () => {
      expect(PaginationUtils.validateParams(50, 0)).toBe(true);
      expect(PaginationUtils.validateParams(1, 0)).toBe(true);
      expect(PaginationUtils.validateParams(100, 1000)).toBe(true);
    });

    it('should reject limit over maximum', () => {
      expect(PaginationUtils.validateParams(101, 0)).toBe(false);
    });

    it('should reject limit under minimum', () => {
      expect(PaginationUtils.validateParams(0, 0)).toBe(false);
    });

    it('should reject negative offset', () => {
      expect(PaginationUtils.validateParams(50, -1)).toBe(false);
    });
  });

  describe('getPaginationHeaders', () => {
    it('should generate correct headers', () => {
      const headers = PaginationUtils.getPaginationHeaders(100, 50, 0);
      expect(headers).toEqual({
        'X-Total-Count': '100',
        'X-Pagination-Limit': '50',
        'X-Pagination-Offset': '0',
        'X-Pagination-Has-More': 'true',
      });
    });

    it('should set hasMore to false on last page', () => {
      const headers = PaginationUtils.getPaginationHeaders(50, 50, 0);
      expect(headers['X-Pagination-Has-More']).toBe('false');
    });
  });
});
