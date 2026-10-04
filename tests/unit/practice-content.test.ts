import { ALL_PRACTICES } from '../../src/data/practices/index';

/**
 * Workflows whose practices must have full content (details, examples, references).
 * Override locally with CONTENT_WORKFLOWS=package,renv to check a subset.
 */
const ENFORCED_WORKFLOWS: string[] = [
  'r-script',
  'quarto',
  'rmarkdown',
  'shiny',
  'package',
  'renv',
  'targets',
  'plumber',
  'analysis',
  'bookdown',
  'blogdown',
  'shinytest',
];

const scope = process.env.CONTENT_WORKFLOWS
  ? process.env.CONTENT_WORKFLOWS.split(',').map((s) => s.trim())
  : ENFORCED_WORKFLOWS;

const inScope = ALL_PRACTICES.filter((p) => scope.includes(p.workflow));

describe('practice content', () => {
  it('has a defined scope', () => {
    expect(Array.isArray(scope)).toBe(true);
  });

  const table = inScope.map((p) => [p.id, p] as const);
  const eachPractice = table.length > 0 ? describe.each(table) : (): void => undefined;

  eachPractice('%s', (_id: string, p: (typeof ALL_PRACTICES)[number]) => {
    it('has details', () => {
      expect(typeof p.details).toBe('string');
      expect(p.details!.trim().length).toBeGreaterThanOrEqual(60);
    });

    it('has distinct good and bad examples', () => {
      expect(p.goodExample?.trim().length ?? 0).toBeGreaterThanOrEqual(10);
      expect(p.badExample?.trim().length ?? 0).toBeGreaterThanOrEqual(10);
      expect(p.goodExample).not.toBe(p.badExample);
    });

    it('has https references', () => {
      expect(p.references?.length ?? 0).toBeGreaterThanOrEqual(1);
      for (const ref of p.references ?? []) {
        expect(ref).toMatch(/^https:\/\/[^\s]+$/);
      }
      expect(new Set(p.references).size).toBe(p.references?.length ?? 0);
    });
  });
});
