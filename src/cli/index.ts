import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { detectCommand } from './commands/detect.js';
import { validateCommand } from './commands/validate.js';
import { templateCommand } from './commands/template.js';
import { reportCommand } from './commands/report.js';

export async function createCLI(): Promise<Command> {
  const program = new Command();

  program
    .name('r-practices')
    .description('R Best Practices CLI Tool - Validate and scaffold R projects')
    .version('1.0.0');

  // Detect command
  program
    .command('detect <path>')
    .description('Detect the R workflow type for a project directory')
    .option('-j, --json', 'Output as JSON')
    .action(async (path, options) => {
      try {
        await detectCommand(path, options);
      } catch (error) {
        logger.error('Error in detect command', error);
        process.exit(1);
      }
    });

  // Validate command
  program
    .command('validate <path>')
    .description('Validate an R project against best practices')
    .option('-w, --workflow <type>', 'Specify workflow type (auto-detect if omitted)')
    .option('-s, --severity <levels>', 'Filter by severity levels (comma-separated)')
    .option('-c, --category <categories>', 'Filter by categories (comma-separated)')
    .option('-l, --limit <number>', 'Limit number of findings', '0')
    .option('-j, --json', 'Output as JSON')
    .option('--watch', 'Watch for file changes and re-validate')
    .action(async (path, options) => {
      try {
        await validateCommand(path, options);
      } catch (error) {
        logger.error('Error in validate command', error);
        process.exit(1);
      }
    });

  // Template command
  program
    .command('template <workflow>')
    .description('Generate a project template for a specific R workflow')
    .option('-n, --name <name>', 'Project name')
    .option('-a, --author <name>', 'Author name')
    .option('-e, --email <email>', 'Author email')
    .option('-o, --output <dir>', 'Output directory for generated files')
    .action(async (workflow, options) => {
      try {
        await templateCommand(workflow, options);
      } catch (error) {
        logger.error('Error in template command', error);
        process.exit(1);
      }
    });

  // Report command
  program
    .command('report <path>')
    .description('Generate an HTML report of project validation')
    .option('-w, --workflow <type>', 'Specify workflow type (auto-detect if omitted)')
    .option('-o, --output <file>', 'Output HTML file path')
    .action(async (path, options) => {
      try {
        await reportCommand(path, options);
      } catch (error) {
        logger.error('Error in report command', error);
        process.exit(1);
      }
    });

  return program;
}

export async function runCLI(argv: string[]): Promise<void> {
  const program = await createCLI();
  await program.parseAsync(argv);
}
