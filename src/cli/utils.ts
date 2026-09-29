import * as fs from 'fs';
import * as path from 'path';

export interface CLIOptions {
  watch?: boolean;
  output?: string;
  format?: 'json' | 'text' | 'html';
  verbose?: boolean;
  quiet?: boolean;
  name?: string;
  author?: string;
  email?: string;
  force?: boolean;
  severity?: string;
  category?: string;
  limit?: number;
  [key: string]: unknown;
}

export class CLIFormatter {
  static colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
  };

  static colorize(text: string, color: keyof typeof CLIFormatter.colors): string {
    if (process.env.NO_COLOR) return text;
    return `${this.colors[color]}${text}${this.colors.reset}`;
  }

  static success(message: string): void {
    console.log(this.colorize('✓', 'green'), message);
  }

  static error(message: string): void {
    console.error(this.colorize('✗', 'red'), message);
  }

  static warn(message: string): void {
    console.warn(this.colorize('⚠', 'yellow'), message);
  }

  static info(message: string): void {
    console.log(this.colorize('ℹ', 'blue'), message);
  }

  static header(text: string): void {
    console.log(this.colorize(text, 'bright'));
    console.log(this.colorize('═'.repeat(text.length), 'gray'));
  }

  static section(text: string): void {
    console.log('\n' + this.colorize(text, 'cyan'));
  }

  static table(data: Array<Record<string, any>>, columns: string[]): void {
    if (data.length === 0) {
      this.info('No data to display');
      return;
    }

    const widths: Record<string, number> = {};
    columns.forEach((col) => {
      widths[col] = Math.max(
        col.length,
        ...data.map((row) => String(row[col] || '').length),
      );
    });

    const printRow = (values: string[]): void => {
      console.log(values.map((v, i) => v.padEnd(widths[columns[i]])).join(' │ '));
    };

    printRow(columns);
    console.log(
      columns
        .map((col) => '─'.repeat(widths[col]))
        .join('─┼─'),
    );

    data.forEach((row) => {
      printRow(columns.map((col) => String(row[col] || '')));
    });
  }

  static progress(current: number, total: number, label: string = ''): void {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.floor((percentage / 100) * 30);
    const empty = 30 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const text = `${bar} ${percentage}%${label ? ` ${label}` : ''}`;
    process.stdout.write('\r' + text);
    if (current === total) {
      process.stdout.write('\n');
    }
  }

  static spinner(message: string): { stop: () => void } {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frame = 0;
    const interval = setInterval(() => {
      process.stdout.write(`\r${frames[frame % frames.length]} ${message}`);
      frame++;
    }, 80);

    return {
      stop: () => {
        clearInterval(interval);
        process.stdout.write('\r');
      },
    };
  }
}

export class ConfigLoader {
  private static readonly CONFIG_NAMES = [
    '.r-best-practicesrc',
    '.r-best-practicesrc.json',
    '.r-best-practicesrc.js',
    'r-best-practices.config.json',
  ];

  static loadConfig(startPath: string = process.cwd()): Partial<CLIOptions> {
    let currentPath = startPath;

    while (true) {
      for (const configName of this.CONFIG_NAMES) {
        const configPath = path.join(currentPath, configName);
        if (fs.existsSync(configPath)) {
          try {
            if (configName.endsWith('.js')) {
              delete require.cache[require.resolve(configPath)];
              return require(configPath);
            } else {
              const content = fs.readFileSync(configPath, 'utf-8');
              return JSON.parse(content);
            }
          } catch (error) {
            CLIFormatter.warn(`Failed to load config from ${configPath}`);
          }
        }
      }

      const parent = path.dirname(currentPath);
      if (parent === currentPath) break;
      currentPath = parent;
    }

    return {};
  }

  static saveConfig(options: Partial<CLIOptions>, filePath: string): void {
    fs.writeFileSync(filePath, JSON.stringify(options, null, 2));
    CLIFormatter.success(`Config saved to ${filePath}`);
  }
}

export class FileWatcher {
  private watchedPaths: Set<string> = new Set();
  private callback?: (filePath: string) => void;

  watch(dirPath: string, callback: (filePath: string) => void): void {
    this.callback = callback;
    this.watchDirectory(dirPath);
  }

  private watchDirectory(dirPath: string): void {
    if (this.watchedPaths.has(dirPath)) return;
    this.watchedPaths.add(dirPath);

    fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      if (
        filename &&
        (filename.endsWith('.R') ||
          filename.endsWith('.Rmd') ||
          filename.endsWith('.qmd') ||
          filename.endsWith('.r'))
      ) {
        this.callback?.(path.join(dirPath, filename));
      }
    });
  }

  stop(): void {
    this.watchedPaths.clear();
  }
}

export function parseArgs(args: string[]): { command: string; args: string[]; options: Record<string, any> } {
  const command = args[0] || '';
  const commandArgs: string[] = [];
  const options: Record<string, any> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value || true;
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      options[key] = true;
    } else {
      commandArgs.push(arg);
    }
  }

  return { command, args: commandArgs, options };
}

export function getProjectPath(inputPath?: string): string {
  if (!inputPath) {
    return process.cwd();
  }

  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  return path.resolve(process.cwd(), inputPath);
}
