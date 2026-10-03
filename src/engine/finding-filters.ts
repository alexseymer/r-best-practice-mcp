import { CATEGORIES, Finding, FindingSummary, SEVERITIES, Severity } from '../types/finding.js';

export interface FindingFilterOptions {
  /** Keep findings at least this severe. */
  minSeverity?: Severity;
  /** Keep findings in any of these categories (empty or omitted = all). */
  categories?: readonly string[];
  /** Keep at most this many findings (applied last; non-positive = no limit). */
  maxFindings?: number;
}

/** Higher number = more severe. */
export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  important: 3,
  recommended: 2,
  info: 1,
};

/**
 * Single implementation of finding filtering, shared by project and file validation.
 * Order: minimum severity, categories, then the maxFindings cap.
 */
export function applyFindingFilters(
  findings: Finding[],
  options: FindingFilterOptions = {}
): Finding[] {
  let result = findings;
  if (options.minSeverity) {
    const min = SEVERITY_RANK[options.minSeverity];
    result = result.filter((f) => SEVERITY_RANK[f.severity] >= min);
  }
  if (options.categories && options.categories.length > 0) {
    const wanted = options.categories;
    result = result.filter((f) => wanted.includes(f.category));
  }
  if (options.maxFindings && options.maxFindings > 0) {
    result = result.slice(0, options.maxFindings);
  }
  return result;
}

/** Count findings by severity and category (zero-filled). Call before filtering. */
export function summarizeFindings(findings: Finding[]): FindingSummary {
  const bySeverity = Object.fromEntries(
    SEVERITIES.map((s) => [s, 0])
  ) as FindingSummary['bySeverity'];
  const byCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c, 0])
  ) as FindingSummary['byCategory'];
  for (const f of findings) {
    if (f.severity in bySeverity) bySeverity[f.severity]++;
    if (f.category in byCategory) byCategory[f.category]++;
  }
  return { total: findings.length, bySeverity, byCategory };
}
