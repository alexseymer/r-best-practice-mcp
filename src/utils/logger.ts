type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private minLevel: LogLevel = 'info';

  private static levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const levelValue = Logger.levels[level];
    const minLevelValue = Logger.levels[this.minLevel];

    if (levelValue >= minLevelValue) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

      if (data !== undefined) {
        console.log(`${prefix} ${message}`, data);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }
}

export const logger = new Logger();
