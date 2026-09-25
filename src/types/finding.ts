export type Severity = 'critical' | 'important' | 'recommended' | 'info';

export type Category =
  | 'structure'
  | 'naming'
  | 'documentation'
  | 'performance'
  | 'security'
  | 'testing'
  | 'dependency'
  | 'style';

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

export interface ValidationResult {
  filePath: string;
  workflow: string;
  findings: Finding[];
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
