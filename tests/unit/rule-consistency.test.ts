import fs from 'fs';
import path from 'path';
import { ALL_PRACTICES } from '../../src/data/practices/index';
import { ALL_RULES, listRuleIds } from '../../src/engine/rules/index';

// Internal ids that are not backed by a practice.
const INTERNAL_RULE_IDS = new Set(['validation-error']);

const SEVERITIES = ['critical', 'important', 'recommended', 'info'];
const CATEGORIES = [
  'structure',
  'naming',
  'documentation',
  'performance',
  'security',
  'testing',
  'dependency',
  'style',
];
const ENFORCEMENTS = ['automated', 'guidance'];
const WORKFLOWS = [
  'r-script',
  'quarto',
  'shiny',
  'package',
  'rmarkdown',
  'renv',
  'targets',
  'plumber',
  'analysis',
  'bookdown',
  'blogdown',
  'shinytest',
];

/** Rule ids written as `id: '...'` literals in validator.ts (the original inline rules). */
function legacyRuleIds(): Set<string> {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/engine/validator.ts'), 'utf-8');
  const ids = [...src.matchAll(/\bid:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
  return new Set(ids.filter((id) => !INTERNAL_RULE_IDS.has(id)));
}

describe('practice / rule consistency', () => {
  const practiceIds = ALL_PRACTICES.map((p) => p.id);
  const legacy = legacyRuleIds();
  const registry = listRuleIds();
  const emitted = new Set([...legacy, ...registry]);

  it('practice ids are unique', () => {
    const dupes = practiceIds.filter((id, i) => practiceIds.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('every practice has valid enum values', () => {
    for (const p of ALL_PRACTICES) {
      expect(SEVERITIES).toContain(p.severity);
      expect(CATEGORIES).toContain(p.category);
      expect(ENFORCEMENTS).toContain(p.enforcement);
      expect(WORKFLOWS).toContain(p.workflow);
    }
  });

  it('registry rule ids are unique and not duplicated by inline rules', () => {
    const dupes = registry.filter((id, i) => registry.indexOf(id) !== i);
    expect(dupes).toEqual([]);
    expect(registry.filter((id) => legacy.has(id))).toEqual([]);
  });

  it('every registered rule declares at least one workflow', () => {
    expect(ALL_RULES.filter((r) => r.workflows.length === 0).map((r) => r.id)).toEqual([]);
  });

  it('every rule id emitted by the validator is a practice id', () => {
    const missing = [...emitted].filter((id) => !practiceIds.includes(id));
    expect(missing).toEqual([]);
  });

  it("practices marked 'automated' have a rule, 'guidance' practices have none", () => {
    const automated = new Set(
      ALL_PRACTICES.filter((p) => p.enforcement === 'automated').map((p) => p.id)
    );
    const automatedWithoutRule = [...automated].filter((id) => !emitted.has(id));
    const guidanceWithRule = ALL_PRACTICES.filter(
      (p) => p.enforcement === 'guidance' && emitted.has(p.id)
    ).map((p) => p.id);
    expect(automatedWithoutRule).toEqual([]);
    expect(guidanceWithRule).toEqual([]);
  });

  it('a registered rule only targets workflows of its practice', () => {
    for (const rule of ALL_RULES) {
      const practice = ALL_PRACTICES.find((p) => p.id === rule.id);
      expect(practice).toBeDefined();
      expect(rule.workflows).toContain(practice!.workflow);
    }
  });
});
