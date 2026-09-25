import { Finding, Severity, ValidationResult } from '../types/finding.js';
import { Workflow } from '../types/workflow.js';
import { FileUtils } from '../utils/file.js';
import { logger } from '../utils/logger.js';

export interface ValidatorOptions {
  maxFindings?: number;
  minSeverity?: Severity;
  categories?: string[];
}

export class Validator {
  async validateProject(
    dirPath: string,
    workflow: Workflow,
    options: ValidatorOptions = {}
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    logger.info(`Validating ${workflow} project: ${dirPath}`);

    try {
      // Run workflow-specific validators
      switch (workflow) {
        case 'r-script':
          findings.push(...(await this.validateRScript(dirPath)));
          break;
        case 'quarto':
          findings.push(...(await this.validateQuarto(dirPath)));
          break;
        case 'shiny':
          findings.push(...(await this.validateShiny(dirPath)));
          break;
        case 'package':
          findings.push(...(await this.validatePackage(dirPath)));
          break;
        case 'rmarkdown':
          findings.push(...(await this.validateRMarkdown(dirPath)));
          break;
        case 'renv':
          findings.push(...(await this.validateRenv(dirPath)));
          break;
        case 'targets':
          findings.push(...(await this.validateTargets(dirPath)));
          break;
        case 'plumber':
          findings.push(...(await this.validatePlumber(dirPath)));
          break;
        case 'analysis':
          findings.push(...(await this.validateAnalysis(dirPath)));
          break;
      }

      // Filter findings
      let filtered = findings;
      if (options.minSeverity) {
        filtered = this.filterBySeverity(filtered, options.minSeverity);
      }
      if (options.categories && options.categories.length > 0) {
        filtered = filtered.filter((f) => options.categories!.includes(f.category));
      }
      if (options.maxFindings) {
        filtered = filtered.slice(0, options.maxFindings);
      }

      const duration = Date.now() - startTime;
      logger.info(`Found ${filtered.length} issues in ${duration}ms`);

      return {
        filePath: dirPath,
        workflow,
        findings: filtered,
        timestamp: Date.now(),
        duration,
      };
    } catch (error) {
      logger.error(`Error validating ${workflow}`, error);
      return {
        filePath: dirPath,
        workflow,
        findings: [
          {
            id: 'validation-error',
            severity: 'critical' as const,
            category: 'structure',
            message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      };
    }
  }

  async validateFile(filePath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const ext = FileUtils.getExtension(filePath);

    try {
      const content = await FileUtils.readFile(filePath);
      const lines = content.split('\n');

      // Check file structure
      if (ext === '.R') {
        findings.push(...this.validateRFile(filePath, lines));
      } else if (ext === '.qmd') {
        findings.push(...this.validateQmdFile(filePath, lines));
      } else if (ext === '.Rmd') {
        findings.push(...this.validateRmdFile(filePath, lines));
      }
    } catch (error) {
      logger.error(`Error validating file ${filePath}`, error);
    }

    return findings;
  }

  // ============== R SCRIPT VALIDATORS ==============
  private async validateRScript(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const rFiles = await FileUtils.listFiles(dirPath, /\.R$/, false);

    // Check for header
    if (rFiles.length > 0) {
      const mainFile = rFiles[0];
      const content = await FileUtils.readFile(mainFile);
      const lines = content.split('\n');

      // Check header comment
      if (!lines[0]?.startsWith('#')) {
        findings.push({
          id: 'rscript-header',
          severity: 'recommended',
          category: 'documentation',
          file: mainFile,
          line: 1,
          message: 'Script should start with header comment',
          suggestions: [
            '# Purpose: [description]',
            '# Author: [name]',
            '# Date: [date]',
          ],
        });
      }

      // Check for global variables
      const globalVarPattern = /^\w+\s*<-\s*(?!function)/;
      lines.forEach((line, idx) => {
        if (globalVarPattern.test(line) && !line.trim().startsWith('#')) {
          findings.push({
            id: 'rscript-globals',
            severity: 'important',
            category: 'structure',
            file: mainFile,
            line: idx + 1,
            message: 'Avoid global variables - use functions instead',
            suggestions: [
              'Wrap logic in functions with parameters',
              'Use local scope for variables',
            ],
          });
        }
      });
    }

    return findings;
  }

  // ============== QUARTO VALIDATORS ==============
  private async validateQuarto(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const qmdFiles = await FileUtils.listFiles(dirPath, /\.qmd$/, false);

    for (const file of qmdFiles) {
      const fileFindings = await this.validateFile(file);
      findings.push(...fileFindings);
    }

    // Check for README
    const readmeExists = await FileUtils.exists(`${dirPath}/README.md`);
    if (!readmeExists && qmdFiles.length > 0) {
      findings.push({
        id: 'analysis-readme',
        severity: 'recommended',
        category: 'documentation',
        message: 'Add README.md to document the analysis',
      });
    }

    return findings;
  }

  // ============== SHINY VALIDATORS ==============
  private async validateShiny(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check for app.R or ui.R/server.R
    const appRExists = await FileUtils.exists(`${dirPath}/app.R`);
    const uiRExists = await FileUtils.exists(`${dirPath}/ui.R`);
    const serverRExists = await FileUtils.exists(`${dirPath}/server.R`);

    if (!appRExists && !(uiRExists && serverRExists)) {
      findings.push({
        id: 'shiny-structure',
        severity: 'important',
        category: 'structure',
        message: 'Shiny app should have either app.R or ui.R/server.R',
        suggestions: [
          'Create app.R with ui and server functions',
          'Or create separate ui.R and server.R files',
        ],
      });
    }

    // Check for README
    const readmeExists = await FileUtils.exists(`${dirPath}/README.md`);
    if (!readmeExists) {
      findings.push({
        id: 'shiny-readme',
        severity: 'recommended',
        category: 'documentation',
        message: 'Add README.md with Shiny app documentation',
      });
    }

    return findings;
  }

  // ============== PACKAGE VALIDATORS ==============
  private async validatePackage(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check DESCRIPTION
    const descExists = await FileUtils.exists(`${dirPath}/DESCRIPTION`);
    if (!descExists) {
      findings.push({
        id: 'pkg-description',
        severity: 'critical',
        category: 'structure',
        message: 'Package must have DESCRIPTION file',
      });
      return findings;
    }

    const desc = await FileUtils.readFile(`${dirPath}/DESCRIPTION`);
    const descLines = desc.split('\n');

    // Check required fields
    const requiredFields = ['Package', 'Version', 'Title', 'Author', 'Maintainer', 'License'];
    requiredFields.forEach((field) => {
      if (!desc.includes(`${field}:`)) {
        findings.push({
          id: 'pkg-description',
          severity: 'important',
          category: 'structure',
          message: `DESCRIPTION missing required field: ${field}`,
        });
      }
    });

    // Check for R directory
    const rDirExists = await FileUtils.isDirectory(`${dirPath}/R`);
    if (!rDirExists) {
      findings.push({
        id: 'pkg-structure',
        severity: 'important',
        category: 'structure',
        message: 'Package should have R/ directory for source files',
      });
    }

    // Check for tests
    const testsExist = await FileUtils.isDirectory(`${dirPath}/tests`);
    if (!testsExist) {
      findings.push({
        id: 'pkg-tests',
        severity: 'important',
        category: 'testing',
        message: 'Add tests/ directory with testthat tests',
        suggestions: ['Create tests/testthat/ directory', 'Add test_*.R files'],
      });
    }

    // Check for LICENSE
    const licenseExists = await FileUtils.exists(`${dirPath}/LICENSE`);
    if (!licenseExists) {
      findings.push({
        id: 'pkg-license',
        severity: 'critical',
        category: 'structure',
        message: 'Package must have LICENSE file',
      });
    }

    return findings;
  }

  // ============== RENV VALIDATORS ==============
  private async validateRenv(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    const lockExists = await FileUtils.exists(`${dirPath}/renv.lock`);
    if (!lockExists) {
      findings.push({
        id: 'renv-lock',
        severity: 'critical',
        category: 'structure',
        message: 'renv project must have renv.lock file',
        suggestions: ['Run renv::init() to create renv.lock'],
      });
    }

    return findings;
  }

  // ============== TARGETS VALIDATORS ==============
  private async validateTargets(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    const targetsExists = await FileUtils.exists(`${dirPath}/_targets.R`);
    if (!targetsExists) {
      findings.push({
        id: 'targets-structure',
        severity: 'important',
        category: 'structure',
        message: 'targets project must have _targets.R file',
      });
      return findings;
    }

    const content = await FileUtils.readFile(`${dirPath}/_targets.R`);

    // Check for list() call
    if (!content.includes('list(')) {
      findings.push({
        id: 'targets-structure',
        severity: 'important',
        category: 'structure',
        message: '_targets.R should define targets using list()',
      });
    }

    return findings;
  }

  // ============== PLUMBER VALIDATORS ==============
  private async validatePlumber(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const rFiles = await FileUtils.listFiles(dirPath, /\.R$/, false);

    for (const file of rFiles) {
      const content = await FileUtils.readFile(file);

      // Check for input validation
      const hasValidation = /validate|check|if\s*\(/.test(content);
      if (!hasValidation) {
        findings.push({
          id: 'plumber-validation',
          severity: 'critical',
          category: 'security',
          file: file,
          message: 'API should validate and sanitize all inputs',
          suggestions: ['Add input validation for all parameters', 'Check data types and ranges'],
        });
      }

      // Check for error handling
      const hasErrorHandling = /tryCatch|stop|warning/.test(content);
      if (!hasErrorHandling) {
        findings.push({
          id: 'plumber-error',
          severity: 'recommended',
          category: 'structure',
          file: file,
          message: 'Add error handling to API endpoints',
        });
      }
    }

    return findings;
  }

  // ============== R MARKDOWN VALIDATORS ==============
  private async validateRMarkdown(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const rmdFiles = await FileUtils.listFiles(dirPath, /\.Rmd$/, false);

    for (const file of rmdFiles) {
      const fileFindings = await this.validateFile(file);
      findings.push(...fileFindings);
    }

    return findings;
  }

  // ============== DATA ANALYSIS VALIDATORS ==============
  private async validateAnalysis(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check directory structure
    const dirs = ['data', 'R', 'output'];
    for (const dir of dirs) {
      const exists = await FileUtils.isDirectory(`${dirPath}/${dir}`);
      if (!exists) {
        findings.push({
          id: 'analysis-structure',
          severity: 'recommended',
          category: 'structure',
          message: `Analysis project should have ${dir}/ directory`,
        });
      }
    }

    return findings;
  }

  // ============== FILE-LEVEL VALIDATORS ==============
  private validateRFile(filePath: string, lines: string[]): Finding[] {
    const findings: Finding[] = [];

    // Check for functions
    const hasFunctions = lines.some((l) => /^[a-zA-Z_]\w*\s*<-\s*function/.test(l));
    if (!hasFunctions && lines.length > 50) {
      findings.push({
        id: 'rscript-functions',
        severity: 'important',
        category: 'structure',
        file: filePath,
        message: 'Large scripts should contain functions for reusable logic',
      });
    }

    return findings;
  }

  private validateQmdFile(filePath: string, lines: string[]): Finding[] {
    const findings: Finding[] = [];

    // Check for YAML header
    if (!lines[0]?.startsWith('---')) {
      findings.push({
        id: 'quarto-yaml',
        severity: 'recommended',
        category: 'documentation',
        file: filePath,
        line: 1,
        message: 'Quarto document should have YAML frontmatter',
      });
    }

    // Check for labeled chunks
    const unlabeledChunks: number[] = [];
    lines.forEach((line, idx) => {
      if (line.includes('```{r}') && !line.includes('label:')) {
        unlabeledChunks.push(idx + 1);
      }
    });

    if (unlabeledChunks.length > 0) {
      findings.push({
        id: 'quarto-labels',
        severity: 'recommended',
        category: 'structure',
        file: filePath,
        line: unlabeledChunks[0],
        message: 'Code chunks should have descriptive labels',
        suggestions: ['Use #| label: chunk-name in each code block'],
      });
    }

    return findings;
  }

  private validateRmdFile(filePath: string, lines: string[]): Finding[] {
    const findings: Finding[] = [];

    // Check for YAML header
    if (!lines[0]?.startsWith('---')) {
      findings.push({
        id: 'rmd-yaml',
        severity: 'recommended',
        category: 'documentation',
        file: filePath,
        line: 1,
        message: 'R Markdown should have YAML header',
      });
    }

    return findings;
  }

  private filterBySeverity(findings: Finding[], minSeverity: Severity): Finding[] {
    const severityOrder: Record<Severity, number> = {
      critical: 4,
      important: 3,
      recommended: 2,
      info: 1,
    };

    const minValue = severityOrder[minSeverity];
    return findings.filter((f) => severityOrder[f.severity] >= minValue);
  }
}
