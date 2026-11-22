/**
 * Pure parameter parsing/validation helpers used by the MCP server.
 * Input is untyped (query string, JSON body or MCP arguments); output is typed options or a
 * message starting with the offending parameter name.
 */
import { CATEGORIES, SEVERITIES } from '../types/finding.js';
import { FindingFilterOptions } from '../engine/finding-filters.js';

export const MAX_FINDINGS_LIMIT = 1000;

export type ParamErrorCode = 'INVALID_PARAMETER' | 'INVALID_WORKFLOW';

export type ParamResult<T> =
  { ok: true; value: T } | { ok: false; code: ParamErrorCode; message: string };

const ok = <T>(value: T): ParamResult<T> => ({ ok: true, value });
const fail = (message: string, code: ParamErrorCode = 'INVALID_PARAMETER'): ParamResult<never> => ({
  ok: false,
  code,
  message,
});

/** undefined, null and the empty string all mean "parameter not supplied". */
export function isOmitted(raw: unknown): boolean {
  return raw === undefined || raw === null || raw === '';
}

/** Validate a single-valued enum parameter. */
export function parseEnumParam<T extends string>(
  name: string,
  raw: unknown,
  allowed: readonly T[]
): ParamResult<T | undefined> {
  if (isOmitted(raw)) return ok(undefined);
  if (typeof raw === 'string' && (allowed as readonly string[]).includes(raw)) {
    return ok(raw as T);
  }
  return fail(`${name} must be one of: ${allowed.join(', ')}`);
}

/** Validate an integer parameter (number or decimal string) within [min, max]. */
export function parseIntegerParam(
  name: string,
  raw: unknown,
  min: number,
  max: number
): ParamResult<number | undefined> {
  if (isOmitted(raw)) return ok(undefined);
  let n: number | undefined;
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    n = raw;
  } else if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) {
    n = Number(raw.trim());
  }
  if (n === undefined || !Number.isSafeInteger(n) || n < min || n > max) {
    return fail(`${name} must be an integer between ${min} and ${max}`);
  }
  return ok(n);
}

/**
 * Validate a list parameter given as an array or a comma separated string. Entries are trimmed,
 * empties dropped and duplicates removed. Returns undefined when nothing was supplied.
 */
export function parseListParam(
  name: string,
  raw: unknown,
  allowed?: readonly string[]
): ParamResult<string[] | undefined> {
  if (isOmitted(raw)) return ok(undefined);
  const parts: unknown[] = Array.isArray(raw) ? raw : [raw];
  const values: string[] = [];
  for (const part of parts) {
    if (typeof part !== 'string') {
      return fail(`${name} must be an array of strings (or a comma separated string)`);
    }
    for (const piece of part.split(',')) {
      const trimmed = piece.trim();
      if (trimmed && !values.includes(trimmed)) values.push(trimmed);
    }
  }
  if (values.length === 0) return ok(undefined);
  if (allowed) {
    const bad = values.filter((v) => !allowed.includes(v));
    if (bad.length > 0) {
      return fail(
        `${name} contains invalid value(s) (${bad.join(', ')}); allowed: ${allowed.join(', ')}`
      );
    }
  }
  return ok(values);
}

/** Parse `minSeverity`, `categories` and `maxFindings` for check_project. */
export function parseFindingFilters(raw: {
  minSeverity?: unknown;
  categories?: unknown;
  maxFindings?: unknown;
}): ParamResult<FindingFilterOptions> {
  const minSeverity = parseEnumParam('minSeverity', raw.minSeverity, SEVERITIES);
  if (!minSeverity.ok) return minSeverity;
  const categories = parseListParam('categories', raw.categories, CATEGORIES);
  if (!categories.ok) return categories;
  const maxFindings = parseIntegerParam('maxFindings', raw.maxFindings, 1, MAX_FINDINGS_LIMIT);
  if (!maxFindings.ok) return maxFindings;

  const filters: FindingFilterOptions = {};
  if (minSeverity.value) filters.minSeverity = minSeverity.value;
  if (categories.value) filters.categories = categories.value;
  if (maxFindings.value !== undefined) filters.maxFindings = maxFindings.value;
  return ok(filters);
}
