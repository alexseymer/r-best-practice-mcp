import { Workflow } from './workflow.js';

export interface TemplateFile {
  path: string;
  content: string;
}

export interface Template {
  workflow: Workflow;
  name: string;
  description: string;
  files: TemplateFile[];
  directories: string[];
}

export interface GeneratedTemplate {
  workflow: Workflow;
  files: TemplateFile[];
  directories: string[];
  timestamp: number;
}

export interface TemplateGeneratorOptions {
  includeComments?: boolean;
  includeLicense?: boolean;
  authorName?: string;
  authorEmail?: string;
  projectName?: string;
}
