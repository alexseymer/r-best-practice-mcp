import { Workflow } from '../types/workflow.js';
import { GeneratedTemplate, TemplateFile, TemplateGeneratorOptions } from '../types/template.js';
import { logger } from '../utils/logger.js';
import { generateRScript } from './templates/r-script.js';
import { generateQuarto } from './templates/quarto.js';
import { generateShiny } from './templates/shiny.js';
import { generatePackage } from './templates/package.js';
import { generateRMarkdown } from './templates/rmarkdown.js';
import { generateRenv } from './templates/renv.js';
import { generateTargets } from './templates/targets.js';
import { generatePlumber } from './templates/plumber.js';
import { generateAnalysis } from './templates/analysis.js';
import { generateBookdown } from './templates/bookdown.js';
import { generateBlogdown } from './templates/blogdown.js';
import { generateShinytest } from './templates/shinytest.js';

export class TemplateGenerator {
  async generate(
    workflow: Workflow,
    options: TemplateGeneratorOptions = {}
  ): Promise<GeneratedTemplate> {
    logger.info(`Generating template for ${workflow}`, options);

    let files: TemplateFile[] = [];
    let directories: string[] = [];

    switch (workflow) {
      case 'r-script':
        ({ files, directories } = generateRScript(options));
        break;
      case 'quarto':
        ({ files, directories } = generateQuarto(options));
        break;
      case 'shiny':
        ({ files, directories } = generateShiny(options));
        break;
      case 'package':
        ({ files, directories } = generatePackage(options));
        break;
      case 'rmarkdown':
        ({ files, directories } = generateRMarkdown(options));
        break;
      case 'renv':
        ({ files, directories } = generateRenv(options));
        break;
      case 'targets':
        ({ files, directories } = generateTargets(options));
        break;
      case 'plumber':
        ({ files, directories } = generatePlumber(options));
        break;
      case 'analysis':
        ({ files, directories } = generateAnalysis(options));
        break;
      case 'bookdown':
        ({ files, directories } = generateBookdown(options));
        break;
      case 'blogdown':
        ({ files, directories } = generateBlogdown(options));
        break;
      case 'shinytest':
        ({ files, directories } = generateShinytest(options));
        break;
      default:
        logger.warn(`Unknown workflow: ${workflow}`);
    }

    logger.info(`Generated ${files.length} files for ${workflow}`);

    return {
      workflow,
      files,
      directories,
      timestamp: Date.now(),
    };
  }
}
