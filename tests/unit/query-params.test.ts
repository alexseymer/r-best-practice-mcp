import {
  isOmitted,
  parseEnumParam,
  parseFindingFilters,
  parseIntegerParam,
  parseListParam,
  parsePracticeFilters,
  parseTextParam,
} from '../../src/utils/query-params';

describe('query-params helpers', () => {
  describe('isOmitted', () => {
    it('treats undefined, null and empty string as omitted', () => {
      expect(isOmitted(undefined)).toBe(true);
      expect(isOmitted(null)).toBe(true);
      expect(isOmitted('')).toBe(true);
      expect(isOmitted(0)).toBe(false);
      expect(isOmitted('x')).toBe(false);
    });
  });

  describe('parseEnumParam', () => {
    const allowed = ['a', 'b'] as const;
    it('accepts allowed values and omitted input', () => {
      expect(parseEnumParam('p', 'a', allowed)).toEqual({ ok: true, value: 'a' });
      expect(parseEnumParam('p', undefined, allowed)).toEqual({ ok: true, value: undefined });
      expect(parseEnumParam('p', '', allowed)).toEqual({ ok: true, value: undefined });
    });
    it('rejects others with a message starting with the param name', () => {
      for (const bad of ['c', 'A', 5, ['a'], {}]) {
        const r = parseEnumParam('p', bad, allowed);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.code).toBe('INVALID_PARAMETER');
          expect(r.message).toBe('p must be one of: a, b');
        }
      }
    });
  });

  describe('parseIntegerParam', () => {
    it('accepts integers and numeric strings in range', () => {
      expect(parseIntegerParam('n', 5, 1, 10)).toEqual({ ok: true, value: 5 });
      expect(parseIntegerParam('n', '10', 1, 10)).toEqual({ ok: true, value: 10 });
      expect(parseIntegerParam('n', undefined, 1, 10)).toEqual({ ok: true, value: undefined });
    });
    it('rejects out of range, fractions, junk and non-numbers', () => {
      const bad = [0, 11, -1, 1.5, '1.5', 'abc', '1e2', NaN, true, [], '9999999999999999999'];
      for (const value of bad) {
        const r = parseIntegerParam('n', value, 1, 10);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.message).toBe('n must be an integer between 1 and 10');
      }
    });
  });

  describe('parseListParam', () => {
    it('accepts arrays and comma separated strings, trimming and de-duplicating', () => {
      expect(parseListParam('l', ['a', 'b', 'a'])).toEqual({ ok: true, value: ['a', 'b'] });
      expect(parseListParam('l', ' a, b ,,a')).toEqual({ ok: true, value: ['a', 'b'] });
      expect(parseListParam('l', ['a,b', 'c'])).toEqual({ ok: true, value: ['a', 'b', 'c'] });
    });
    it('treats omitted and empty as undefined', () => {
      expect(parseListParam('l', undefined)).toEqual({ ok: true, value: undefined });
      expect(parseListParam('l', [])).toEqual({ ok: true, value: undefined });
      expect(parseListParam('l', ' , ')).toEqual({ ok: true, value: undefined });
    });
    it('rejects non-strings and values outside the allowed set', () => {
      expect(parseListParam('l', [1])).toMatchObject({ ok: false });
      expect(parseListParam('l', { a: 1 })).toMatchObject({ ok: false });
      const r = parseListParam('l', ['a', 'z'], ['a', 'b']);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/^l contains invalid value\(s\) \(z\)/);
    });
  });

  describe('parseTextParam', () => {
    it('accepts strings up to the limit', () => {
      expect(parseTextParam('q', 'hello')).toEqual({ ok: true, value: 'hello' });
      expect(parseTextParam('q', undefined)).toEqual({ ok: true, value: undefined });
    });
    it('rejects non-strings and over-long text', () => {
      expect(parseTextParam('q', 5)).toMatchObject({ ok: false });
      expect(parseTextParam('q', 'x'.repeat(201))).toMatchObject({ ok: false });
    });
  });

  describe('parseFindingFilters', () => {
    it('returns an empty object when nothing is supplied', () => {
      expect(parseFindingFilters({})).toEqual({ ok: true, value: {} });
      expect(parseFindingFilters({ minSeverity: '', categories: [], maxFindings: null })).toEqual({
        ok: true,
        value: {},
      });
    });
    it('parses valid filters', () => {
      expect(
        parseFindingFilters({
          minSeverity: 'important',
          categories: ['style', 'testing'],
          maxFindings: '25',
        })
      ).toEqual({
        ok: true,
        value: { minSeverity: 'important', categories: ['style', 'testing'], maxFindings: 25 },
      });
    });
    it.each([
      [{ minSeverity: 'severe' }, /^minSeverity /],
      [{ categories: ['nope'] }, /^categories /],
      [{ categories: 'style,nope' }, /^categories /],
      [{ maxFindings: 0 }, /^maxFindings /],
      [{ maxFindings: 1001 }, /^maxFindings /],
      [{ maxFindings: 'many' }, /^maxFindings /],
    ])('rejects %j', (input, pattern) => {
      const r = parseFindingFilters(input);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe('INVALID_PARAMETER');
        expect(r.message).toMatch(pattern);
      }
    });
  });

  describe('parsePracticeFilters', () => {
    it('returns an empty object when nothing is supplied', () => {
      expect(parsePracticeFilters({})).toEqual({ ok: true, value: {} });
    });
    it('parses every option', () => {
      expect(
        parsePracticeFilters({
          workflow: 'package',
          category: 'testing',
          minSeverity: 'recommended',
          tags: 'shiny, testing',
          enforcement: 'automated',
          q: '  Roxygen ',
          limit: '20',
        })
      ).toEqual({
        ok: true,
        value: {
          workflow: 'package',
          category: 'testing',
          minSeverity: 'recommended',
          tags: ['shiny', 'testing'],
          enforcement: 'automated',
          query: 'Roxygen',
          limit: 20,
        },
      });
    });
    it('prefers query over its alias q and ignores blank text', () => {
      expect(parsePracticeFilters({ query: 'a', q: 'b' })).toMatchObject({ value: { query: 'a' } });
      expect(parsePracticeFilters({ q: 'b' })).toMatchObject({ value: { query: 'b' } });
      expect(parsePracticeFilters({ q: '   ' })).toEqual({ ok: true, value: {} });
    });
    it('reports invalid workflow with INVALID_WORKFLOW', () => {
      expect(parsePracticeFilters({ workflow: 'cobol' })).toEqual({
        ok: false,
        code: 'INVALID_WORKFLOW',
        message: 'Invalid workflow type: cobol',
      });
    });
    it.each([
      [{ category: 'misc' }, /^category /],
      [{ minSeverity: 'huge' }, /^minSeverity /],
      [{ enforcement: 'manual' }, /^enforcement /],
      [{ limit: 0 }, /^limit /],
      [{ limit: 201 }, /^limit /],
      [{ limit: 'x' }, /^limit /],
      [{ tags: [1] }, /^tags /],
      [{ q: 'x'.repeat(300) }, /^query /],
    ])('rejects %j', (input, pattern) => {
      const r = parsePracticeFilters(input);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe('INVALID_PARAMETER');
        expect(r.message).toMatch(pattern);
      }
    });
  });
});
