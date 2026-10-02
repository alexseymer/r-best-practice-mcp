import { Finding } from '../../types/finding.js';
import { Workflow } from '../../types/workflow.js';

export interface RuleContext {
  dirPath: string;
  workflow: Workflow;
}

export interface RuleDef {
  /** Must equal the id of exactly one Practice (enforcement: 'automated') in the knowledge base. */
  id: string;
  workflows: Workflow[];
  run(ctx: RuleContext): Promise<Finding[]>;
}
