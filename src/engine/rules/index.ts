import { Finding } from '../../types/finding.js';
import { Workflow } from '../../types/workflow.js';
import { logger } from '../../utils/logger.js';
import { RuleContext, RuleDef } from './types.js';
import { analysisRules } from './analysis.js';
import { blogdownRules } from './blogdown.js';
import { bookdownRules } from './bookdown.js';
import { packageRules } from './package.js';
import { plumberRules } from './plumber.js';
import { quartoRules } from './quarto.js';
import { renvRules } from './renv.js';
import { rmarkdownRules } from './rmarkdown.js';
import { rscriptRules } from './rscript.js';
import { shinyRules } from './shiny.js';
import { shinytestRules } from './shinytest.js';
import { targetsRules } from './targets.js';

export const ALL_RULES: RuleDef[] = [
  ...rscriptRules,
  ...quartoRules,
  ...rmarkdownRules,
  ...shinyRules,
  ...packageRules,
  ...renvRules,
  ...targetsRules,
  ...plumberRules,
  ...analysisRules,
  ...bookdownRules,
  ...blogdownRules,
  ...shinytestRules,
];

export function listRuleIds(): string[] {
  return ALL_RULES.map((r) => r.id);
}

export function rulesForWorkflow(workflow: Workflow): RuleDef[] {
  return ALL_RULES.filter((r) => r.workflows.includes(workflow));
}

/** Runs every registered rule for the workflow; a throwing rule is logged and skipped. */
export async function runRegisteredRules(ctx: RuleContext): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const rule of rulesForWorkflow(ctx.workflow)) {
    try {
      findings.push(...(await rule.run(ctx)));
    } catch (error) {
      logger.warn(
        `Rule ${rule.id} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return findings;
}
