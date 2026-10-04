/** Severities from most to least severe. */
export const SEVERITIES = ['critical', 'important', 'recommended', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CATEGORIES = [
  'structure',
  'naming',
  'documentation',
  'performance',
  'security',
  'testing',
  'dependency',
  'style',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Finding {
  id: string;
  severity: Severity;
  category: Category;
  file?: string;
  line?: number;
  message: string;
  details?: string;
  suggestions?: string[];
  link?: string;
}

/** Finding counts computed before any filter is applied ("N of M" in clients). */
export interface FindingSummary {
  total: number;
  bySeverity: Record<Severity, number>;
  byCategory: Record<Category, number>;
}

/** Result of validating a single file (REST and MCP `validate_file`). */
export interface FileValidationResult {
  path: string;
  findings: Finding[];
  summary: FindingSummary;
}

export interface ValidationResult {
  filePath: string;
  workflow: string;
  findings: Finding[];
  /** Counts of all findings before filtering; `findings` may be a filtered subset. */
  summary?: FindingSummary;
  timestamp: number;
  duration: number; // ms
}

export interface ValidationOptions {
  workflow?: string;
  categories?: Category[];
  minSeverity?: Severity;
  maxFindings?: number;
  timeout?: number;
}
