import { logger } from '../utils/logger.js';

export interface PerformanceMetrics {
  name: string;
  duration: number; // milliseconds
  memoryUsed: number; // bytes
  callCount: number;
  averageTime: number;
  status: 'fast' | 'moderate' | 'slow';
}

export interface ProfileResult {
  timestamp: number;
  operations: PerformanceMetrics[];
  totalDuration: number;
  summary: {
    slowestOperation: string;
    averageTime: number;
    totalOperations: number;
  };
}

export class PerformanceProfiler {
  private operations: Map<string, PerformanceMetrics> = new Map();
  private startTime: number = 0;
  private startMemory: number = 0;

  start(): void {
    this.startTime = performance.now();
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.startMemory = process.memoryUsage().heapUsed;
    }
  }

  mark(operationName: string, duration?: number, memoryUsed?: number): void {
    const actualDuration = duration || performance.now() - this.startTime;
    const actualMemory = memoryUsed || 0;

    if (this.operations.has(operationName)) {
      const existing = this.operations.get(operationName)!;
      existing.duration += actualDuration;
      existing.memoryUsed += actualMemory;
      existing.callCount++;
      existing.averageTime = existing.duration / existing.callCount;
      existing.status = this.getStatus(existing.averageTime);
    } else {
      this.operations.set(operationName, {
        name: operationName,
        duration: actualDuration,
        memoryUsed: actualMemory,
        callCount: 1,
        averageTime: actualDuration,
        status: this.getStatus(actualDuration),
      });
    }
  }

  private getStatus(duration: number): 'fast' | 'moderate' | 'slow' {
    if (duration < 10) return 'fast';
    if (duration < 100) return 'moderate';
    return 'slow';
  }

  end(): ProfileResult {
    const totalDuration = performance.now() - this.startTime;
    const operations = Array.from(this.operations.values());

    const slowest = operations.reduce((a, b) => (a.duration > b.duration ? a : b), operations[0]);
    const averageTime = operations.reduce((sum, op) => sum + op.averageTime, 0) / operations.length;

    return {
      timestamp: Date.now(),
      operations,
      totalDuration,
      summary: {
        slowestOperation: slowest?.name || 'unknown',
        averageTime,
        totalOperations: operations.length,
      },
    };
  }

  getOptimizationSuggestions(result: ProfileResult): string[] {
    const suggestions: string[] = [];

    // Identify slow operations
    const slowOps = result.operations.filter((op) => op.status === 'slow');
    if (slowOps.length > 0) {
      suggestions.push(`Optimize slow operations: ${slowOps.map((op) => op.name).join(', ')}`);
    }

    // Check for redundant operations
    const slowestOp = result.operations.reduce((a, b) => (a.duration > b.duration ? a : b));
    if (slowestOp && slowestOp.callCount > 5) {
      suggestions.push(`Operation "${slowestOp.name}" called ${slowestOp.callCount} times - consider caching results`);
    }

    // Memory analysis
    const highMemoryOps = result.operations.filter((op) => op.memoryUsed > 10 * 1024 * 1024); // 10MB
    if (highMemoryOps.length > 0) {
      suggestions.push(
        `High memory usage: ${highMemoryOps.map((op) => `${op.name} (${this.formatBytes(op.memoryUsed)})`).join(', ')}`
      );
    }

    return suggestions;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  reset(): void {
    this.operations.clear();
  }
}

export class ValidationPerformanceTracker {
  private profiler = new PerformanceProfiler();

  async trackValidation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    this.profiler.start();
    try {
      const result = await fn();
      this.profiler.mark(operation);
      return result;
    } catch (error) {
      this.profiler.mark(operation);
      throw error;
    }
  }

  trackSync<T>(operation: string, fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.profiler.mark(operation, duration);
      return result;
    } catch (error) {
      throw error;
    }
  }

  getProfile(): ProfileResult {
    return this.profiler.end();
  }

  reset(): void {
    this.profiler.reset();
  }
}
