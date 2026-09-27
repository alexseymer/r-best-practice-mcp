import { detectCommand } from './commands/detect';
import { validateCommand } from './commands/validate';
import { templateCommand } from './commands/template';
import { reportCommand } from './commands/report';
import { CLIFormatter, CLIOptions, ConfigLoader, FileWatcher, parseArgs } from './utils';

const HELP_TEXT = `
R Best Practices CLI

Usage: r-best-practices <command> [options] [args]

Commands:
  detect <path>              Detect workflow type for a project
  validate <path> [workflow] Validate project against best practices
  template <workflow> [name] Generate a new project scaffold
  report <path>              Generate HTML validation report
  help                       Show this help message
  version                    Show version information

Options:
  --watch                    Watch for changes and re-validate
  --output <path>            Output directory for generated files
  --format <format>          Output format: json, text, html (default: text)
  --verbose                  Show detailed output
  --quiet                    Suppress non-essential output
  --force                    Overwrite existing files

Examples:
  # Detect workflow type
  r-best-practices detect /path/to/project

  # Validate project
  r-best-practices validate /path/to/project package

  # Generate template
  r-best-practices template shiny my-app --output ~/projects

  # Generate report
  r-best-practices report /path/to/project --output .

  # Watch mode
  r-best-practices validate /path/to/project --watch
`;

export async function run(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const { command, args: cmdArgs, options } = parseArgs(args);

  const config = ConfigLoader.loadConfig();
  const cliOptions: CLIOptions = {
    watch: options.watch || config.watch,
    output: options.output || config.output,
    format: options.format || config.format || 'text',
    verbose: options.verbose || config.verbose || false,
    quiet: options.quiet || config.quiet || false,
  };

  try {
    switch (command) {
      case 'detect':
        await detectCommand(cmdArgs, cliOptions);
        break;

      case 'validate':
        await handleValidateCommand(cmdArgs, cliOptions, options.watch);
        break;

      case 'template':
        options.name = cmdArgs[1];
        options.author = options.author || options.a;
        options.email = options.email || options.e;
        options.force = options.force || options.f;
        await templateCommand(cmdArgs, { ...cliOptions, ...options });
        break;

      case 'report':
        await reportCommand(cmdArgs, cliOptions);
        break;

      case 'help':
        console.log(HELP_TEXT);
        break;

      case 'version':
        const pkg = require('../../package.json');
        console.log(`r-best-practices version ${pkg.version}`);
        break;

      default:
        CLIFormatter.error(`Unknown command: ${command}`);
        console.log(HELP_TEXT);
        process.exit(1);
    }
  } catch (error) {
    CLIFormatter.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

async function handleValidateCommand(
  args: string[],
  options: CLIOptions,
  watch: boolean = false,
): Promise<void> {
  if (watch) {
    const { FileWatcher } = await import('./utils');
    const watcher = new FileWatcher();
    const projectPath = args[0];

    if (!options.quiet) {
      CLIFormatter.info(`Watching ${projectPath} for changes...`);
      CLIFormatter.warn('Press Ctrl+C to stop');
    }

    let isValidating = false;

    watcher.watch(projectPath, async (filePath) => {
      if (isValidating) return;
      isValidating = true;

      try {
        if (!options.quiet) {
          console.log(`\n${CLIFormatter.colorize(`[${new Date().toLocaleTimeString()}]`, 'gray')} File changed: ${filePath}`);
        }
        await validateCommand(args, options);
      } finally {
        isValidating = false;
      }
    });

    await validateCommand(args, options);
    await new Promise(() => {});
  } else {
    await validateCommand(args, options);
  }
}
