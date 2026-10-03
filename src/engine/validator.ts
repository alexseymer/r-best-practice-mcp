import { FileValidationResult, Finding, ValidationResult } from '../types/finding.js';
import { Workflow } from '../types/workflow.js';
import { FileUtils } from '../utils/file.js';
import { logger } from '../utils/logger.js';
import { runRegisteredRules } from './rules/index.js';
import { applyFindingFilters, FindingFilterOptions, summarizeFindings } from './finding-filters.js';

const RSCRIPT_GLOBALS_THRESHOLD = 15;

export type ValidatorOptions = FindingFilterOptions;

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
        case 'bookdown':
          findings.push(...(await this.validateBookdown(dirPath)));
          break;
        case 'blogdown':
          findings.push(...(await this.validateBlogdown(dirPath)));
          break;
        case 'shinytest':
          findings.push(...(await this.validateShinytest(dirPath)));
          break;
      }

      findings.push(...(await runRegisteredRules({ dirPath, workflow })));

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
          suggestions: ['# Purpose: [description]', '# Author: [name]', '# Date: [date]'],
        });
      }
    }

    // One finding for the project: the first root script that is mostly top-level assignments
    for (const file of rFiles) {
      const content = await FileUtils.readFile(file);
      const globals = this.findTopLevelAssignments(content.split(/\r?\n/));
      if (globals.length > RSCRIPT_GLOBALS_THRESHOLD) {
        findings.push({
          id: 'rscript-globals',
          severity: 'important',
          category: 'structure',
          file,
          line: globals[0],
          message: `Consider wrapping logic in functions: ${globals.length} top-level assignments create many global variables`,
          suggestions: [
            'Wrap logic in functions with parameters',
            'Add a main() entry point and call it at the end of the script',
            'Use local scope for intermediate variables',
          ],
        });
        break;
      }
    }

    return findings;
  }

  /** Line numbers (1-based) of column-0 assignments whose value is not a function. */
  private findTopLevelAssignments(lines: string[]): number[] {
    const result: number[] = [];
    const assignment = /^[A-Za-z_.][\w.]*\s*(<-|=)(?!=)\s*(.*)$/;
    lines.forEach((line, idx) => {
      if (line.trim().startsWith('#')) return;
      const match = assignment.exec(line);
      if (match && !/^(function\b|\\\()/.test(match[2])) {
        result.push(idx + 1);
      }
    });
    return result;
  }

  // ============== QUARTO VALIDATORS ==============
  private async validateQuarto(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const qmdFiles = await FileUtils.listFiles(dirPath, /\.qmd$/, false);

    for (const file of qmdFiles) {
      const fileFindings = await this.validateFile(file);
      findings.push(...fileFindings);
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
        suggestions: ['Create README.md describing the app, how to run it and its deployment'],
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
        suggestions: ['Run usethis::use_description() to create DESCRIPTION'],
      });
      return findings;
    }

    const desc = await FileUtils.readFile(`${dirPath}/DESCRIPTION`);

    // Check required fields (matched at line start, not as substrings)
    const hasField = (field: string) => new RegExp(`^${field}:`, 'm').test(desc.replace(/\r/g, ''));
    const missing = ['Package', 'Version', 'Title', 'Description', 'License'].filter(
      (f) => !hasField(f)
    );
    if (!hasField('Authors@R') && !(hasField('Author') && hasField('Maintainer'))) {
      missing.push('Authors@R (or both Author and Maintainer)');
    }
    if (missing.length > 0) {
      findings.push({
        id: 'pkg-description',
        severity: 'critical',
        category: 'structure',
        message: `DESCRIPTION missing required field(s): ${missing.join(', ')}`,
        suggestions: [
          'Add the missing fields to DESCRIPTION',
          'Use usethis::use_description() to generate a complete DESCRIPTION',
        ],
      });
    }

    // Check for R directory
    const rDirExists = await FileUtils.isDirectory(`${dirPath}/R`);
    if (!rDirExists) {
      findings.push({
        id: 'pkg-structure',
        severity: 'important',
        category: 'structure',
        message: 'Package should have R/ directory for source files',
        suggestions: ['Create an R/ directory and move source files into it'],
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

    // Check license declaration
    const licenseMatch = /^License:[ \t]*(.*(?:\r?\n[ \t]+.*)*)/m.exec(desc);
    if (!licenseMatch) {
      findings.push({
        id: 'pkg-license',
        severity: 'critical',
        category: 'structure',
        message: 'DESCRIPTION must declare a License field',
        suggestions: [
          'Add a License: field to DESCRIPTION',
          'Run usethis::use_mit_license() or another usethis::use_*_license() helper',
        ],
      });
    } else if (/file\s+LICEN[CS]E/.test(licenseMatch[1])) {
      let licenseFileExists = false;
      for (const name of ['LICENSE', 'LICENSE.md', 'LICENCE', 'LICENCE.md']) {
        if (await FileUtils.exists(`${dirPath}/${name}`)) {
          licenseFileExists = true;
          break;
        }
      }
      if (!licenseFileExists) {
        findings.push({
          id: 'pkg-license',
          severity: 'critical',
          category: 'structure',
          message: 'DESCRIPTION references "file LICENSE" but no LICENSE file exists',
          suggestions: [
            'Create the LICENSE file referenced by DESCRIPTION',
            'Or use a standard license such as License: MIT + file LICENSE via usethis::use_mit_license()',
          ],
        });
      }
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
        severity: 'recommended',
        category: 'structure',
        message: 'targets project must have _targets.R file',
        suggestions: ['Run targets::use_targets() to create _targets.R'],
      });
      return findings;
    }

    const content = await FileUtils.readFile(`${dirPath}/_targets.R`);

    // Check for list() call
    if (!content.includes('list(')) {
      findings.push({
        id: 'targets-structure',
        severity: 'recommended',
        category: 'structure',
        message: '_targets.R should define targets using list()',
        suggestions: ['End _targets.R with list(tar_target(name, command), ...)'],
      });
    }

    return findings;
  }

  // ============== PLUMBER VALIDATORS ==============
  private async validatePlumber(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const rFiles = await FileUtils.listFiles(dirPath, /\.R$/, false);

    const endpoint = /^\s*#[*']\s*@(get|post|put|delete|patch|head|options)\b/im;

    for (const file of rFiles) {
      const raw = await FileUtils.readFile(file);
      if (!endpoint.test(raw)) continue;
      // Full-line comments (including annotations) must not satisfy the checks
      const content = raw
        .split(/\r?\n/)
        .filter((l) => !l.trim().startsWith('#'))
        .join('\n');

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
      const hasErrorHandling = /\b(tryCatch|stop|warning)\s*\(/.test(content);
      if (!hasErrorHandling) {
        findings.push({
          id: 'plumber-error',
          severity: 'important',
          category: 'structure',
          file: file,
          message: 'Add error handling to API endpoints',
          suggestions: [
            'Wrap endpoint logic in tryCatch()',
            'Return meaningful HTTP status codes with res$status',
          ],
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

    // Check for README
    const readmeNames = ['README.md', 'README.Rmd', 'README'];
    let readmeExists = false;
    for (const name of readmeNames) {
      if (await FileUtils.exists(`${dirPath}/${name}`)) {
        readmeExists = true;
        break;
      }
    }
    if (!readmeExists) {
      findings.push({
        id: 'analysis-readme',
        severity: 'recommended',
        category: 'documentation',
        message: 'Add README.md to document the analysis',
        suggestions: ['Create README.md describing the question, data sources and how to run it'],
      });
    }

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
          suggestions: [`Create a ${dir}/ directory`],
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
        suggestions: ['Extract repeated logic into named functions'],
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
        suggestions: ['Start the document with a --- YAML block containing title and format'],
      });
    }

    // Check for labeled chunks
    const firstUnlabeled = this.findFirstUnlabeledRChunk(lines);
    if (firstUnlabeled !== undefined) {
      findings.push({
        id: 'quarto-labels',
        severity: 'recommended',
        category: 'structure',
        file: filePath,
        line: firstUnlabeled,
        message: 'Code chunks should have descriptive labels',
        suggestions: ['Add #| label: chunk-name as the first line inside each R code chunk'],
      });
    }

    return findings;
  }

  /** 1-based line of the first R chunk without a label, or undefined. */
  private findFirstUnlabeledRChunk(rawLines: string[]): number | undefined {
    const lines = rawLines.map((l) => l.replace(/\r$/, ''));
    const fence = /^\s*`{3,}\s*\{\s*[rR](?=[\s,}])([^}]*)\}/;
    for (let i = 0; i < lines.length; i++) {
      const match = fence.exec(lines[i]);
      if (!match) continue;
      const header = match[1];
      const firstItem = header.split(',')[0].trim();
      const labelledInFence =
        /label\s*:/.test(header) ||
        /(^|[\s,])label\s*=/.test(header) ||
        /^[\w.-]+$/.test(firstItem);
      if (labelledInFence) continue;
      let labelledInOptions = false;
      for (let j = i + 1; j < lines.length && lines[j].trimStart().startsWith('#|'); j++) {
        if (/^\s*#\|\s*label\s*:/.test(lines[j])) {
          labelledInOptions = true;
          break;
        }
      }
      if (!labelledInOptions) return i + 1;
    }
    return undefined;
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
        suggestions: ['Start the document with a --- YAML block containing title and output'],
      });
    }

    return findings;
  }

  // ============== BOOKDOWN VALIDATORS ==============
  private async validateBookdown(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check for _bookdown.yml or _bookdown.yaml
    const bookdownYml = await FileUtils.exists(`${dirPath}/_bookdown.yml`);
    const bookdownYaml = await FileUtils.exists(`${dirPath}/_bookdown.yaml`);

    if (!bookdownYml && !bookdownYaml) {
      findings.push({
        id: 'bookdown-config',
        severity: 'important',
        category: 'structure',
        message: 'Bookdown project should have _bookdown.yml',
        suggestions: ['Create _bookdown.yml with book configuration'],
      });
    }

    // Check for index.Rmd
    const indexRmd = await FileUtils.exists(`${dirPath}/index.Rmd`);
    if (!indexRmd) {
      findings.push({
        id: 'bookdown-index',
        severity: 'critical',
        category: 'structure',
        message: 'Bookdown book must have index.Rmd',
        suggestions: ['Create index.Rmd with the book YAML header and introduction'],
      });
    }

    // Check for README
    const readmeExists = await FileUtils.exists(`${dirPath}/README.md`);
    if (!readmeExists) {
      findings.push({
        id: 'bookdown-readme',
        severity: 'recommended',
        category: 'documentation',
        message: 'Add README.md to document the book',
        suggestions: ['Create README.md explaining how to build and contribute to the book'],
      });
    }

    return findings;
  }

  // ============== BLOGDOWN VALIDATORS ==============
  private async validateBlogdown(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check for config file (Hugo accepts several names and a config directory)
    let hasConfig = await FileUtils.isDirectory(`${dirPath}/config/_default`);
    for (const name of [
      'config.toml',
      'config.yaml',
      'config.yml',
      'hugo.toml',
      'hugo.yaml',
      'hugo.yml',
    ]) {
      if (!hasConfig && (await FileUtils.exists(`${dirPath}/${name}`))) hasConfig = true;
    }

    if (!hasConfig) {
      findings.push({
        id: 'blogdown-config',
        severity: 'critical',
        category: 'structure',
        message:
          'Blogdown site must have a Hugo config (config.toml, hugo.toml, config.yaml, ... or config/_default/)',
        suggestions: ['Create config.toml with site configuration'],
      });
    }

    // Check for content directory
    const contentDir = await FileUtils.isDirectory(`${dirPath}/content`);
    if (!contentDir) {
      findings.push({
        id: 'blogdown-content-structure',
        severity: 'important',
        category: 'structure',
        message: 'Blogdown site should have content/ directory',
        suggestions: ['Create a content/ directory for posts and pages'],
      });
    }

    // Check for themes directory
    const themesDir = await FileUtils.isDirectory(`${dirPath}/themes`);
    if (!themesDir) {
      findings.push({
        id: 'blogdown-theme',
        severity: 'recommended',
        category: 'structure',
        message: 'Blogdown site should have themes/ directory for custom theme',
        suggestions: ['Install a Hugo theme, e.g. blogdown::install_theme()'],
      });
    }

    return findings;
  }

  // ============== SHINYTEST VALIDATORS ==============
  private async validateShinytest(dirPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check for test directory (shinytest2 runs through testthat)
    const shinytestDir = await FileUtils.isDirectory(`${dirPath}/tests/shinytest`);
    const testthatDir = await FileUtils.isDirectory(`${dirPath}/tests/testthat`);
    const testDir = shinytestDir || testthatDir;
    if (!testDir) {
      findings.push({
        id: 'shinytest-structure',
        severity: 'important',
        category: 'structure',
        message: 'Shinytest project should have tests/shinytest/ or tests/testthat/ directory',
        suggestions: [
          'Create tests/testthat/ for shinytest2 tests (shinytest2::use_shinytest2())',
          'Or create tests/shinytest/ for legacy shinytest recordings',
        ],
      });
    }

    // Check for app.R or ui.R/server.R
    const appR = await FileUtils.exists(`${dirPath}/app.R`);
    const uiServer =
      (await FileUtils.exists(`${dirPath}/ui.R`)) &&
      (await FileUtils.exists(`${dirPath}/server.R`));
    if (!appR && !uiServer) {
      findings.push({
        id: 'shinytest-app',
        severity: 'important',
        category: 'structure',
        message: 'Shinytest requires Shiny app.R or ui.R/server.R',
        suggestions: ['Create app.R containing the Shiny app', 'Or create ui.R and server.R'],
      });
    }

    // Check for test setup file
    let testSetup = false;
    for (const rel of [
      'tests/testthat/setup-shinytest2.R',
      'tests/testthat/setup-shinytest.R',
      'tests/testthat/setup.R',
      'tests/setup.R',
      'tests/shinytest/setup.R',
    ]) {
      if (await FileUtils.exists(`${dirPath}/${rel}`)) {
        testSetup = true;
        break;
      }
    }

    if (!testSetup && testDir) {
      findings.push({
        id: 'shinytest-setup',
        severity: 'recommended',
        category: 'structure',
        message: 'Shinytest project should have test setup configuration',
        suggestions: ['Create tests/testthat/setup-shinytest2.R to configure the app under test'],
      });
    }

    return findings;
  }
}
