/**
 * Performance Metrics Tracking
 * Tracks timing and performance data for key operations
 */

export interface RequestMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number; // milliseconds
  timestamp: string;
}

export interface OperationMetrics {
  operationType: 'detection' | 'validation' | 'template-generation' | 'practice-lookup';
  duration: number; // milliseconds
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface MetricsSnapshot {
  requests: RequestMetrics[];
  operations: OperationMetrics[];
  uptime: number; // milliseconds
  averageRequestDuration: number; // milliseconds
  averageOperationDuration: Record<string, number>;
  operationCounts: Record<string, number>;
  errorCounts: Record<string, number>;
}

/**
 * Singleton metrics collector
 */
class MetricsCollector {
  private requests: RequestMetrics[] = [];
  private operations: OperationMetrics[] = [];
  private startTime: number = Date.now();
  private maxHistorySize: number = 1000; // Keep last 1000 entries

  /**
   * Record a request metric
   */
  recordRequest(endpoint: string, method: string, statusCode: number, duration: number): void {
    const metric: RequestMetrics = {
      endpoint,
      method,
      statusCode,
      duration,
      timestamp: new Date().toISOString(),
    };

    this.requests.push(metric);
    this.trimHistory();
  }

  /**
   * Record an operation metric
   */
  recordOperation(
    operationType: 'detection' | 'validation' | 'template-generation' | 'practice-lookup',
    duration: number,
    success: boolean,
    error?: string,
  ): void {
    const metric: OperationMetrics = {
      operationType,
      duration,
      success,
      error,
      timestamp: new Date().toISOString(),
    };

    this.operations.push(metric);
    this.trimHistory();
  }

  /**
   * Get a snapshot of current metrics
   */
  getSnapshot(): MetricsSnapshot {
    const uptime = Date.now() - this.startTime;

    // Calculate average request duration
    const averageRequestDuration =
      this.requests.length > 0
        ? this.requests.reduce((sum, r) => sum + r.duration, 0) / this.requests.length
        : 0;

    // Calculate operation averages and counts
    const operationCounts: Record<string, number> = {};
    const operationDurations: Record<string, number[]> = {};
    const errorCounts: Record<string, number> = {};

    for (const op of this.operations) {
      // Count operations
      operationCounts[op.operationType] = (operationCounts[op.operationType] || 0) + 1;

      // Collect durations for averaging
      if (!operationDurations[op.operationType]) {
        operationDurations[op.operationType] = [];
      }
      operationDurations[op.operationType].push(op.duration);

      // Count errors
      if (!op.success) {
        errorCounts[op.operationType] = (errorCounts[op.operationType] || 0) + 1;
      }
    }

    // Calculate averages
    const averageOperationDuration: Record<string, number> = {};
    for (const [opType, durations] of Object.entries(operationDurations)) {
      averageOperationDuration[opType] = durations.reduce((a, b) => a + b, 0) / durations.length;
    }

    return {
      requests: this.requests.slice(-100), // Return last 100
      operations: this.operations.slice(-100), // Return last 100
      uptime,
      averageRequestDuration,
      averageOperationDuration,
      operationCounts,
      errorCounts,
    };
  }

  /**
   * Get metrics in JSON format for export
   */
  exportJSON(): string {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }

  /**
   * Get metrics in CSV format for export
   */
  exportRequestsCSV(): string {
    if (this.requests.length === 0) {
      return 'endpoint,method,statusCode,duration,timestamp\n';
    }

    const headers = 'endpoint,method,statusCode,duration,timestamp';
    const rows = this.requests.map(
      (r) => `"${r.endpoint}","${r.method}",${r.statusCode},${r.duration},"${r.timestamp}"`,
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Get operations in CSV format for export
   */
  exportOperationsCSV(): string {
    if (this.operations.length === 0) {
      return 'operationType,duration,success,error,timestamp\n';
    }

    const headers = 'operationType,duration,success,error,timestamp';
    const rows = this.operations.map(
      (o) =>
        `"${o.operationType}",${o.duration},${o.success},"${o.error || ''}","${o.timestamp}"`,
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.requests = [];
    this.operations = [];
    this.startTime = Date.now();
  }

  /**
   * Trim history to max size
   */
  private trimHistory(): void {
    if (this.requests.length > this.maxHistorySize) {
      this.requests = this.requests.slice(-this.maxHistorySize);
    }
    if (this.operations.length > this.maxHistorySize) {
      this.operations = this.operations.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get percentile of operation durations
   */
  getPercentile(operationType: string, percentile: number): number | null {
    const durations = this.operations
      .filter((op) => op.operationType === operationType)
      .map((op) => op.duration)
      .sort((a, b) => a - b);

    if (durations.length === 0) {
      return null;
    }

    const index = Math.ceil((percentile / 100) * durations.length) - 1;
    return durations[Math.max(0, index)];
  }

  /**
   * Get min/max/median durations for operation type
   */
  getStats(operationType: string): { min: number; max: number; median: number } | null {
    const durations = this.operations
      .filter((op) => op.operationType === operationType)
      .map((op) => op.duration)
      .sort((a, b) => a - b);

    if (durations.length === 0) {
      return null;
    }

    const min = durations[0];
    const max = durations[durations.length - 1];
    const medianIndex = Math.floor(durations.length / 2);
    const median =
      durations.length % 2 === 0
        ? (durations[medianIndex - 1] + durations[medianIndex]) / 2
        : durations[medianIndex];

    return { min, max, median };
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();
