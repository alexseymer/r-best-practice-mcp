import { FileUtils } from '../utils/file.js';
import { logger } from '../utils/logger.js';
import { Workflow, DetectionResult, DetectionOptions } from '../types/workflow.js';

export class WorkflowDetector {
  async detect(
    dirPath: string,
    options: DetectionOptions = {}
  ): Promise<DetectionResult> {
    const startTime = Date.now();
    logger.info(`Detecting workflow for: ${dirPath}`);

    const isDir = await FileUtils.isDirectory(dirPath);
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
    const appR = await FileUtils.exists(`${dirPath}/app.R`);
    const uiR = await FileUtils.exists(`${dirPath}/ui.R`);
    const serverR = await FileUtils.exists(`${dirPath}/server.R`);

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
    const qmdFiles = await FileUtils.listFiles(dirPath, /\.qmd$/, false);
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
    const rmdFiles = await FileUtils.listFiles(dirPath, /\.Rmd$/, false);
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
    const description = await FileUtils.exists(`${dirPath}/DESCRIPTION`);
    const rDir = await FileUtils.isDirectory(`${dirPath}/R`);

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
    const renvLock = await FileUtils.exists(`${dirPath}/renv.lock`);
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
    const targetsR = await FileUtils.exists(`${dirPath}/_targets.R`);
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
    const rFiles = await FileUtils.listFiles(dirPath, /\.R$/, false);

    for (const file of rFiles) {
      const content = await FileUtils.readFile(file);
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
    const hasDataDir = await FileUtils.isDirectory(`${dirPath}/data`);
    const hasRDir = await FileUtils.isDirectory(`${dirPath}/R`);
    const hasOutputDir = await FileUtils.isDirectory(`${dirPath}/output`);

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

  private determineWorkflow(
    scores: Record<Workflow, number>
  ): [Workflow, number] {
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
