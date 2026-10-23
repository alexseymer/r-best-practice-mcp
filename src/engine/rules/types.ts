import type { ProjectFs } from '../project-fs.js';
import { Finding } from '../../types/finding.js';
import { Workflow } from '../../types/workflow.js';

export interface RuleContext {
  dirPath: string;
  workflow: Workflow;
  /** Where the project's files come from: the server's disk or an in-memory copy. */
  fsys: ProjectFs;
}

export interface RuleDef {
  /** Must equal the id of exactly one Practice (enforcement: 'automated') in the knowledge base. */
  id: string;
  workflows: Workflow[];
  run(ctx: RuleContext): Promise<Finding[]>;
}
