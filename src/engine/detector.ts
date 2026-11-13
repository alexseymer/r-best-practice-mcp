import { isDirectoryAt, listFilesAt, type ProjectFs } from './project-fs.js';
import { pathExists } from './rules/helpers.js';
import { logger } from '../utils/logger.js';
import { Workflow, DetectionResult, DetectionOptions } from '../types/workflow.js';

export class WorkflowDetector {
  constructor(private readonly fsys: ProjectFs) {}

  async detect(dirPath: string, _options: DetectionOptions = {}): Promise<DetectionResult> {
    const startTime = Date.now();
    logger.info(`Detecting workflow for: ${dirPath}`);

    const isDir = await isDirectoryAt(this.fsys, dirPath);
    if (!isDir) {
      return {
        workflow: 'unknown',
        confidence: 0,
        indicators: [],
        filePath: dirPath,
        timestamp: startTime,
      };
    }

    const indicators: string[] = [];
    let scores: Record<Workflow, number> = {
      'r-script': 0,
      quarto: 0,
      shiny: 0,
      package: 0,
      rmarkdown: 0,
      renv: 0,
      targets: 0,
      plumber: 0,
      analysis: 0,
      bookdown: 0,
      blogdown: 0,
      shinytest: 0,
      unknown: 0,
    };

    // Check for characteristic files
    scores = await this.checkShiny(dirPath, scores, indicators);
    scores = await this.checkQuarto(dirPath, scores, indicators);
    scores = await this.checkRMarkdown(dirPath, scores, indicators);
    scores = await this.checkPackage(dirPath, scores, indicators);
    scores = await this.checkRenv(dirPath, scores, indicators);
    scores = await this.checkTargets(dirPath, scores, indicators);
    scores = await this.checkPlumber(dirPath, scores, indicators);
    scores = await this.checkAnalysis(dirPath, scores, indicators);
    scores = await this.checkBookdown(dirPath, scores, indicators);
    scores = await this.checkBlogdown(dirPath, scores, indicators);
    scores = await this.checkShinytest(dirPath, scores, indicators);
    scores = await this.checkRScript(dirPath, scores, indicators);

    // Determine winner
    const [workflow, confidence] = this.determineWorkflow(scores);

    logger.info(`Detected workflow: ${workflow} (${confidence}% confidence)`);

    return {
      workflow,
      confidence,
      indicators,
      filePath: dirPath,
      timestamp: startTime,
    };
  }

  private async checkShiny(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const appR = await pathExists(this.fsys, `${dirPath}/app.R`);
    const uiR = await pathExists(this.fsys, `${dirPath}/ui.R`);
    const serverR = await pathExists(this.fsys, `${dirPath}/server.R`);

    if (appR) {
      scores['shiny'] += 100;
      indicators.push('app.R found');
    }
    if (uiR && serverR) {
      scores['shiny'] += 90;
      indicators.push('ui.R and server.R found');
    }

    return scores;
  }

  private async checkQuarto(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const qmdFiles = await listFilesAt(this.fsys, dirPath, /\.qmd$/, false);
    if (qmdFiles.length > 0) {
      scores['quarto'] += 90;
      indicators.push(`.qmd files found (${qmdFiles.length})`);
    }
    return scores;
  }

  private async checkRMarkdown(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const rmdFiles = await listFilesAt(this.fsys, dirPath, /\.Rmd$/, false);
    if (rmdFiles.length > 0) {
      scores['rmarkdown'] += 85;
      indicators.push(`.Rmd files found (${rmdFiles.length})`);
    }
    return scores;
  }

  private async checkPackage(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const description = await pathExists(this.fsys, `${dirPath}/DESCRIPTION`);
    const rDir = await isDirectoryAt(this.fsys, `${dirPath}/R`);

    if (description && rDir) {
      scores['package'] += 100;
      indicators.push('DESCRIPTION and R/ found');
    } else if (description) {
      scores['package'] += 50;
      indicators.push('DESCRIPTION found');
    }

    return scores;
  }

  private async checkRenv(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const renvLock = await pathExists(this.fsys, `${dirPath}/renv.lock`);
    if (renvLock) {
      scores['renv'] += 95;
      indicators.push('renv.lock found');
    }
    return scores;
  }

  private async checkTargets(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const targetsR = await pathExists(this.fsys, `${dirPath}/_targets.R`);
    if (targetsR) {
      scores['targets'] += 95;
      indicators.push('_targets.R found');
    }
    return scores;
  }

  private async checkPlumber(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const rFiles = await listFilesAt(this.fsys, dirPath, /\.R$/, false);

    for (const file of rFiles) {
      const content = await this.fsys.readFile(file);
      if (/@get|@post|@put|@delete|@patch/.test(content)) {
        scores['plumber'] += 80;
        indicators.push('Plumber decorators found');
        break;
      }
    }

    return scores;
  }

  private async checkAnalysis(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const hasDataDir = await isDirectoryAt(this.fsys, `${dirPath}/data`);
    const hasRDir = await isDirectoryAt(this.fsys, `${dirPath}/R`);
    const hasOutputDir = await isDirectoryAt(this.fsys, `${dirPath}/output`);

    let count = 0;
    if (hasDataDir) count++;
    if (hasRDir) count++;
    if (hasOutputDir) count++;

    if (count >= 2) {
      scores['analysis'] += 70 + count * 10;
      indicators.push(`Standard analysis dirs found (${count}/3)`);
    }

    return scores;
  }

  private async checkBookdown(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const bookdownYml = await pathExists(this.fsys, `${dirPath}/_bookdown.yml`);
    const bookdownYaml = await pathExists(this.fsys, `${dirPath}/_bookdown.yaml`);
    const indexRmd = await pathExists(this.fsys, `${dirPath}/index.Rmd`);
    const chaptersDir = await isDirectoryAt(this.fsys, `${dirPath}/chapters`);

    if ((bookdownYml || bookdownYaml) && indexRmd) {
      scores['bookdown'] += 100;
      indicators.push('_bookdown.yml and index.Rmd found');
    } else if (bookdownYml || bookdownYaml) {
      scores['bookdown'] += 70;
      indicators.push('_bookdown.yml found');
    }

    if (chaptersDir) {
      scores['bookdown'] += 30;
      indicators.push('chapters/ directory found');
    }

    return scores;
  }

  private async checkBlogdown(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const configToml = await pathExists(this.fsys, `${dirPath}/config.toml`);
    const configYaml = await pathExists(this.fsys, `${dirPath}/config.yaml`);
    const contentDir = await isDirectoryAt(this.fsys, `${dirPath}/content`);
    const themesDir = await isDirectoryAt(this.fsys, `${dirPath}/themes`);

    if ((configToml || configYaml) && contentDir) {
      scores['blogdown'] += 100;
      indicators.push('config and content/ found');
    } else if (configToml || configYaml) {
      scores['blogdown'] += 70;
      indicators.push('config.toml/yaml found');
    }

    if (themesDir) {
      scores['blogdown'] += 20;
      indicators.push('themes/ directory found');
    }

    return scores;
  }

  private async checkShinytest(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const shinytestDir = await isDirectoryAt(this.fsys, `${dirPath}/tests/shinytest`);
    const appR = await pathExists(this.fsys, `${dirPath}/app.R`);
    const testFiles = await listFilesAt(this.fsys, dirPath, /\.R$/, false);

    // Check for shinytest-specific patterns in test files
    let hasShinytest = false;
    for (const file of testFiles) {
      const content = await this.fsys.readFile(file);
      if (/shinytest|AppDriver/.test(content)) {
        hasShinytest = true;
        break;
      }
    }

    if (shinytestDir) {
      scores['shinytest'] += 95;
      indicators.push('tests/shinytest/ directory found');
    }

    if (hasShinytest) {
      scores['shinytest'] += 80;
      indicators.push('shinytest code patterns found');
    }

    if (shinytestDir && appR) {
      scores['shinytest'] += 15;
      indicators.push('shinytest setup with Shiny app');
    }

    return scores;
  }

  // Low score on purpose: plain .R files only decide when nothing more specific matches.
  private async checkRScript(
    dirPath: string,
    scores: Record<Workflow, number>,
    indicators: string[]
  ): Promise<Record<Workflow, number>> {
    const rFiles = await listFilesAt(this.fsys, dirPath, /\.[Rr]$/, false);

    if (rFiles.length > 0) {
      scores['r-script'] += 40;
      indicators.push(`R script files found (${rFiles.length})`);
    }

    return scores;
  }

  private determineWorkflow(scores: Record<Workflow, number>): [Workflow, number] {
    const entries = Object.entries(scores).filter(([_, score]) => score > 0);

    if (entries.length === 0) {
      return ['unknown', 0];
    }

    entries.sort((a, b) => b[1] - a[1]);
    const [workflow, score] = entries[0];
    const confidence = Math.min(score, 100);

    return [workflow as Workflow, confidence];
  }
}
