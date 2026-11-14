import { FileValidationResult, Finding, ValidationResult } from '../types/finding.js';
import { Workflow } from '../types/workflow.js';
import { logger } from '../utils/logger.js';
import { runRegisteredRules } from './rules/index.js';
import { checkQmdFile, checkRFile, checkRmdFile } from './rules/file-checks.js';
import type { ProjectFs } from './project-fs.js';
import { applyFindingFilters, FindingFilterOptions, summarizeFindings } from './finding-filters.js';

export type ValidatorOptions = FindingFilterOptions;

const KNOWN_WORKFLOWS = new Set<string>([
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
]);

export const UNKNOWN_WORKFLOW_WARNING =
  'No R project type was detected in this folder, so no workflow-specific checks ran. Choose a workflow type or check the path.';

export class Validator {
  /** Where project files are read from: the server's disk (project-fs-node) or an in-memory copy. */
  constructor(private readonly fsys: ProjectFs) {}

  /** Same result as path.extname: '' for names without a dot or starting with one. */
  private getExtension(filePath: string): string {
    const name = this.fsys.basename(filePath);
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot) : '';
  }

  async validateProject(
    dirPath: string,
    workflow: Workflow,
    options: ValidatorOptions = {}
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    logger.info(`Validating ${workflow} project: ${dirPath}`);

    try {
      findings.push(...(await runRegisteredRules({ dirPath, workflow, fsys: this.fsys })));

      // Summary counts everything found; filters only narrow the returned list.
      const summary = summarizeFindings(findings);
      const filtered = applyFindingFilters(findings, options);

      const duration = Date.now() - startTime;
      logger.info(`Found ${filtered.length} issues in ${duration}ms`);

      return {
        filePath: dirPath,
        workflow,
        findings: filtered,
        summary,
        ...(!KNOWN_WORKFLOWS.has(workflow as string)
          ? { warnings: [UNKNOWN_WORKFLOW_WARNING] }
          : {}),
        timestamp: Date.now(),
        duration,
      };
    } catch (error) {
      logger.error(`Error validating ${workflow}`, error);
      const errorFindings: Finding[] = [
        {
          id: 'validation-error',
          severity: 'critical' as const,
          category: 'structure',
          message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestions: ['Check that the path exists and is readable'],
        },
      ];
      return {
        filePath: dirPath,
        workflow,
        findings: errorFindings,
        summary: summarizeFindings(errorFindings),
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      };
    }
  }

  /** Validate one file; optional filters narrow the returned findings. */
  async validateFile(filePath: string, options: ValidatorOptions = {}): Promise<Finding[]> {
    return applyFindingFilters(await this.collectFileFindings(filePath), options);
  }

  /** Like validateFile, but also returns the pre-filter summary ("N of M"). */
  async validateFileWithSummary(
    filePath: string,
    options: ValidatorOptions = {}
  ): Promise<FileValidationResult> {
    const all = await this.collectFileFindings(filePath);
    return {
      path: filePath,
      findings: applyFindingFilters(all, options),
      summary: summarizeFindings(all),
    };
  }

  private async collectFileFindings(filePath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const ext = this.getExtension(filePath);

    try {
      const content = await this.fsys.readFile(filePath);
      const lines = content.split('\n');

      // Check file structure
      if (ext === '.R') {
        findings.push(...checkRFile(filePath, lines));
      } else if (ext === '.qmd') {
        findings.push(...checkQmdFile(filePath, lines));
      } else if (ext === '.Rmd') {
        findings.push(...checkRmdFile(filePath, lines));
      }
    } catch (error) {
      logger.error(`Error validating file ${filePath}`, error);
    }

    return findings;
  }
}
