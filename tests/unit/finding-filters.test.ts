import { applyFindingFilters, summarizeFindings } from '../../src/engine/finding-filters';
import { Validator } from '../../src/engine/validator';
import { Finding } from '../../src/types/finding';
import { createTempDir, cleanupTempDir, createFile, createPackageFixture } from '../fixtures/setup';

const sample: Finding[] = [
  { id: 'a', severity: 'critical', category: 'security', message: 'a' },
  { id: 'b', severity: 'important', category: 'structure', message: 'b' },
  { id: 'c', severity: 'recommended', category: 'style', message: 'c' },
  { id: 'd', severity: 'info', category: 'style', message: 'd' },
  { id: 'e', severity: 'important', category: 'style', message: 'e' },
];
const ids = (list: Finding[]): string[] => list.map((f) => f.id);

describe('applyFindingFilters', () => {
  it('returns all findings with no options', () => {
    expect(applyFindingFilters(sample)).toEqual(sample);
    expect(applyFindingFilters(sample, {})).toEqual(sample);
  });

  it('keeps findings at least as severe as minSeverity', () => {
    expect(ids(applyFindingFilters(sample, { minSeverity: 'critical' }))).toEqual(['a']);
    expect(ids(applyFindingFilters(sample, { minSeverity: 'important' }))).toEqual(['a', 'b', 'e']);
    expect(applyFindingFilters(sample, { minSeverity: 'info' })).toHaveLength(5);
  });

  it('filters by categories (empty list = no filter)', () => {
    expect(ids(applyFindingFilters(sample, { categories: ['style'] }))).toEqual(['c', 'd', 'e']);
    expect(applyFindingFilters(sample, { categories: [] })).toHaveLength(5);
  });

  it('applies maxFindings last', () => {
    const r = applyFindingFilters(sample, {
      minSeverity: 'important',
      categories: ['style', 'structure'],
      maxFindings: 1,
    });
    expect(ids(r)).toEqual(['b']);
  });

  it('does not mutate its input', () => {
    const copy = [...sample];
    applyFindingFilters(sample, { maxFindings: 1 });
    expect(sample).toEqual(copy);
  });
});

describe('summarizeFindings', () => {
  it('counts totals, severities and categories with zero fill', () => {
    const s = summarizeFindings(sample);
    expect(s.total).toBe(5);
    expect(s.bySeverity).toEqual({ critical: 1, important: 2, recommended: 1, info: 1 });
    expect(s.byCategory).toEqual({
      structure: 1,
      naming: 0,
      documentation: 0,
      performance: 0,
      security: 1,
      testing: 0,
      dependency: 0,
      style: 3,
    });
  });

  it('handles an empty list', () => {
    const s = summarizeFindings([]);
    expect(s.total).toBe(0);
    expect(Object.values(s.bySeverity).every((n) => n === 0)).toBe(true);
  });
});

describe('Validator filters and summary', () => {
  const validator = new Validator();
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });
  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('validateProject summary counts all findings even when filtered', async () => {
    createPackageFixture(tempDir);
    const all = await validator.validateProject(tempDir, 'package');
    expect(all.summary).toBeDefined();
    expect(all.summary!.total).toBe(all.findings.length);
    expect(all.findings.length).toBeGreaterThan(1);

    const filtered = await validator.validateProject(tempDir, 'package', {
      minSeverity: 'critical',
      maxFindings: 1,
    });
    expect(filtered.findings.length).toBeLessThanOrEqual(1);
    expect(filtered.summary).toEqual(all.summary);
  });

  it('validateFile accepts options and validateFileWithSummary reports pre-filter counts', async () => {
    const file = createFile(tempDir, 'doc.qmd', '# Title\n\n```{r}\n1 + 1\n```\n');
    const unfiltered = await validator.validateFile(file);
    expect(unfiltered.length).toBe(2);

    const capped = await validator.validateFile(file, { maxFindings: 1 });
    expect(capped).toHaveLength(1);

    const none = await validator.validateFile(file, { categories: ['testing'] });
    expect(none.every((f) => f.category === 'testing')).toBe(true);

    const detailed = await validator.validateFileWithSummary(file, { maxFindings: 1 });
    expect(detailed.path).toBe(file);
    expect(detailed.findings).toHaveLength(1);
    expect(detailed.summary.total).toBe(unfiltered.length);
  });
});
