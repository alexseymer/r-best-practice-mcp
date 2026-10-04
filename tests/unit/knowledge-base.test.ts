import { KnowledgeBase } from '../../src/data/knowledge-base';

describe('KnowledgeBase', () => {
  let kb: KnowledgeBase;

  beforeEach(() => {
    kb = new KnowledgeBase();
  });

  describe('getPractice', () => {
    it('should return a practice by ID', () => {
      const practice = kb.getPractice('rscript-header');
      expect(practice).toBeDefined();
      expect(practice?.id).toBe('rscript-header');
      expect(practice?.workflow).toBe('r-script');
    });

    it('should return undefined for non-existent ID', () => {
      const practice = kb.getPractice('non-existent-id');
      expect(practice).toBeUndefined();
    });

    it('should include practice details', () => {
      const practice = kb.getPractice('pkg-roxygen');
      expect(practice?.title).toBeDefined();
      expect(practice?.description).toBeDefined();
      expect(practice?.severity).toBeDefined();
      expect(practice?.category).toBeDefined();
    });
  });

  describe('listPractices', () => {
    it('should list all practices when no filters applied', () => {
      const result = kb.listPractices();
      expect(result.practices.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should filter by workflow', () => {
      const result = kb.listPractices({ workflow: 'r-script' });
      expect(result.practices.every((p) => p.workflow === 'r-script')).toBe(true);
    });

    it('should filter by category', () => {
      const result = kb.listPractices({ category: 'documentation' });
      expect(result.practices.every((p) => p.category === 'documentation')).toBe(true);
    });

    it('should filter by minimum severity', () => {
      const result = kb.listPractices({ minSeverity: 'critical' });
      expect(result.practices.length).toBeGreaterThan(0);
      expect(result.practices.every((p) => p.severity === 'critical')).toBe(true);
    });

    it('should keep practices at least as severe as minSeverity', () => {
      const result = kb.listPractices({ minSeverity: 'important' });
      expect(result.practices.every((p) => ['critical', 'important'].includes(p.severity))).toBe(
        true
      );
      expect(result.total).toBeGreaterThan(kb.listPractices({ minSeverity: 'critical' }).total);
    });

    it('should filter by enforcement', () => {
      const automated = kb.listPractices({ enforcement: 'automated' });
      const guidance = kb.listPractices({ enforcement: 'guidance' });
      expect(automated.practices.every((p) => p.enforcement === 'automated')).toBe(true);
      expect(guidance.practices.every((p) => p.enforcement === 'guidance')).toBe(true);
      expect(automated.total + guidance.total).toBe(kb.listPractices().total);
    });

    it('should filter by free-text query over id, title, description, details and tags', () => {
      const all = kb.listPractices().practices;
      const byId = kb.listPractices({ query: 'PKG-ROXYGEN' });
      expect(byId.practices.some((p) => p.id === 'pkg-roxygen')).toBe(true);

      const withDetails = all.find((p) => p.details);
      if (withDetails) {
        const word = withDetails.details!.split(/\s+/).find((w) => w.length > 6)!;
        expect(
          kb.listPractices({ query: word }).practices.some((p) => p.id === withDetails.id)
        ).toBe(true);
      }
      expect(kb.listPractices({ query: 'zzzz-no-such-text' }).total).toBe(0);
      expect(kb.listPractices({ query: '   ' }).total).toBe(all.length);
    });

    it('should combine filters', () => {
      const result = kb.listPractices({
        workflow: 'package',
        minSeverity: 'important',
        query: 'test',
        limit: 3,
      });
      expect(result.practices.length).toBeLessThanOrEqual(3);
      expect(result.practices.every((p) => p.workflow === 'package')).toBe(true);
    });

    it('should apply limit', () => {
      const result = kb.listPractices({ limit: 5 });
      expect(result.practices.length).toBeLessThanOrEqual(5);
    });

    it('should return timestamp', () => {
      const result = kb.listPractices();
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  describe('searchPractices', () => {
    it('should search by title', () => {
      const result = kb.searchPractices('roxygen');
      expect(result.practices.length).toBeGreaterThan(0);
      expect(result.practices.some((p) => p.id === 'pkg-roxygen')).toBe(true);
    });

    it('should search by description', () => {
      const result = kb.searchPractices('testing');
      expect(result.practices.length).toBeGreaterThan(0);
    });

    it('should return empty for no matches', () => {
      const result = kb.searchPractices('xyzabc123');
      expect(result.practices.length).toBe(0);
    });

    it('should be case-insensitive', () => {
      const result = kb.searchPractices('REACTIVE');
      expect(result.practices.length).toBeGreaterThan(0);
    });
  });

  describe('getWorkflows', () => {
    it('should return all supported workflows', () => {
      const workflows = kb.getWorkflows();
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows).toContain('r-script');
      expect(workflows).toContain('shiny');
      expect(workflows).toContain('package');
    });
  });

  describe('getPracticeCountByWorkflow', () => {
    it('should return practice counts for each workflow', () => {
      const counts = kb.getPracticeCountByWorkflow();
      expect(Object.keys(counts).length).toBeGreaterThan(0);
      expect(counts['r-script']).toBeGreaterThan(0);
      expect(counts['package']).toBeGreaterThan(0);
    });

    it('should have total matching number of practices', () => {
      const counts = kb.getPracticeCountByWorkflow();
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const allPractices = kb.listPractices();
      expect(total).toBe(allPractices.total);
    });
  });

  describe('filtering combinations', () => {
    it('should filter by workflow and category', () => {
      const result = kb.listPractices({
        workflow: 'package',
        category: 'documentation',
      });
      expect(
        result.practices.every((p) => p.workflow === 'package' && p.category === 'documentation')
      ).toBe(true);
    });

    it('should filter by tags', () => {
      const result = kb.listPractices({ tags: ['shiny'] });
      expect(result.practices.every((p) => p.tags?.includes('shiny'))).toBe(true);
    });
  });
});
