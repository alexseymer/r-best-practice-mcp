import { Severity, Category } from './finding.js';
import { Workflow } from './workflow.js';

export type Enforcement = 'automated' | 'guidance';

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
  severity?: Severity;
  tags?: string[];
  limit?: number;
}

export interface PracticeQueryResult {
  practices: Practice[];
  total: number;
  timestamp: number;
}
