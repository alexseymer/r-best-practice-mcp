export type Workflow =
  | 'r-script'
  | 'quarto'
  | 'shiny'
  | 'package'
  | 'rmarkdown'
  | 'renv'
  | 'targets'
  | 'plumber'
  | 'analysis'
  | 'unknown';

export interface DetectionResult {
  workflow: Workflow;
  confidence: number; // 0-100
  indicators: string[];
  filePath: string;
  timestamp: number;
}

export interface DetectionOptions {
  checkDepth?: number; // How deep to scan
  timeout?: number; // ms
}
