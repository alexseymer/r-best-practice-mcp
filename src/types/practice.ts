import { Severity, Category } from './finding.js';
import { Workflow } from './workflow.js';

export const ENFORCEMENTS = ['automated', 'guidance'] as const;
export type Enforcement = (typeof ENFORCEMENTS)[number];

export interface Practice {
  id: string;
  title: string;
  workflow: Workflow;
  category: Category;
  severity: Severity;
  /** 'automated': a validator rule with the same id reports violations. 'guidance': advice only. */
  enforcement: Enforcement;
  description: string;
  details?: string;
  goodExample?: string;
  badExample?: string;
  tags?: string[];
  references?: string[];
  check?: (filePath: string, content: string) => boolean;
}

export interface PracticeListOptions {
  workflow?: Workflow;
  category?: Category;
  /** Keep practices at least this severe. */
  minSeverity?: Severity;
  enforcement?: Enforcement;
  /** Case-insensitive substring over id, title, description, details and tags. */
  query?: string;
  /** Keep practices having at least one of these tags. */
  tags?: string[];
  limit?: number;
}

export interface PracticeQueryResult {
  practices: Practice[];
  total: number;
  timestamp: number;
}
