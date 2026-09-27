export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class StructuredLogger {
  private static readonly LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private logLevel: LogLevel;
  private useJsonFormat: boolean;

  constructor(logLevel: LogLevel = 'info', useJsonFormat: boolean = false) {
    this.logLevel = logLevel;
    this.useJsonFormat = useJsonFormat;
  }

  private shouldLog(level: LogLevel): boolean {
    return StructuredLogger.LEVELS[level] >= StructuredLogger.LEVELS[this.logLevel];
  }

  private formatEntry(entry: LogEntry): string {
    if (this.useJsonFormat) {
      return JSON.stringify(entry);
    }

    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const base = `${timestamp} [${level}] ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      return `${base} | ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      return `${base} | Error: ${entry.error.name} - ${entry.error.message}`;
    }

    return base;
  }

  private createEntry(level: LogLevel, message: string, context?: Record<string, any>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      const entry = this.createEntry('debug', message, context);
      console.log(this.formatEntry(entry));
    }
  }

  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      const entry = this.createEntry('info', message, context);
      console.log(this.formatEntry(entry));
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      const entry = this.createEntry('warn', message, context);
      console.warn(this.formatEntry(entry));
    }
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    if (this.shouldLog('error')) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message,
        context,
      };

      if (error) {
        entry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      }

      console.error(this.formatEntry(entry));
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  setJsonFormat(useJson: boolean): void {
    this.useJsonFormat = useJson;
  }

  logRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.info('HTTP Request', {
      method,
      path,
      statusCode,
      durationMs: duration,
      type: 'http_request',
    });
  }

  logValidation(workflow: string, severity: string, count: number): void {
    this.info('Project Validation', {
      workflow,
      severity,
      findingCount: count,
      type: 'validation',
    });
  }

  logDetection(workflow: string, confidence: number): void {
    this.info('Workflow Detection', {
      workflow,
      confidence,
      type: 'detection',
    });
  }

  logSecurityEvent(eventType: string, context?: Record<string, any>): void {
    this.warn('Security Event', {
      eventType,
      ...context,
      type: 'security',
    });
  }

  logRateLimit(ip: string, remaining: number): void {
    if (remaining < 10) {
      this.warn('Rate Limit Approaching', {
        clientIp: ip,
        remaining,
        type: 'rate_limit',
      });
    }
  }
}

export const createLogger = (
  logLevel: LogLevel = 'info',
  useJsonFormat: boolean = false,
): StructuredLogger => {
  return new StructuredLogger(logLevel, useJsonFormat);
};
