import * as fs from 'fs';
import * as path from 'path';
import { FileUtils } from '../utils/file';

export interface ComplexityMetric {
  file: string;
  linesOfCode: number;
  commentLines: number;
  cyclomatic: number;
  nestingDepth: number;
  functionCount: number;
  complexity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
}

export interface ProjectComplexity {
  totalFiles: number;
  averageComplexity: number;
  maxComplexity: number;
  highComplexityFiles: string[];
  totalLinesOfCode: number;
  commentPercentage: number;
  findings: ComplexityFinding[];
}

export interface ComplexityFinding {
  file: string;
  line?: number;
  message: string;
  severity: 'info' | 'warning' | 'error';
  suggestion: string;
}

export class ComplexityAnalyzer {
  async analyzeProject(projectPath: string): Promise<ProjectComplexity> {
    const rFiles = await FileUtils.listFiles(projectPath, '**/*.R', true);
    const metrics: ComplexityMetric[] = [];

    for (const file of rFiles) {
      try {
        const metric = await this.analyzeFile(file);
        metrics.push(metric);
      } catch (error) {
        console.warn(`Failed to analyze ${file}: ${error}`);
      }
    }

    return this.aggregateMetrics(metrics);
  }

  private async analyzeFile(filePath: string): Promise<ComplexityMetric> {
    const content = await FileUtils.readFile(filePath);
    const lines = content.split('\n');

    const linesOfCode = this.countNonEmptyLines(lines);
    const commentLines = this.countCommentLines(lines);
    const cyclomatic = this.calculateCyclomaticComplexity(content);
    const nestingDepth = this.calculateNestingDepth(content);
    const functionCount = this.countFunctions(content);

    const complexity = this.complexityLevel(cyclomatic);
    const score = this.calculateComplexityScore(cyclomatic, nestingDepth, linesOfCode, functionCount);

    return {
      file: filePath,
      linesOfCode,
      commentLines,
      cyclomatic,
      nestingDepth,
      functionCount,
      complexity,
      score,
    };
  }

  private countNonEmptyLines(lines: string[]): number {
    return lines.filter((line) => line.trim().length > 0).length;
  }

  private countCommentLines(lines: string[]): number {
    return lines.filter((line) => line.trim().startsWith('#')).length;
  }

  private calculateCyclomaticComplexity(content: string): number {
    let complexity = 1;

    const ifMatches = content.match(/\bif\s*\(/g) || [];
    const elseMatches = content.match(/\belse\s+if\s*\(/g) || [];
    const forMatches = content.match(/\bfor\s*\(/g) || [];
    const whileMatches = content.match(/\bwhile\s*\(/g) || [];
    const repeatMatches = content.match(/\brepeat\s*\{/g) || [];
    const switchMatches = content.match(/\bswitch\s*\(/g) || [];
    const lapplyMatches = content.match(/\b(lapply|sapply|mapply|vapply)\s*\(/g) || [];

    complexity += ifMatches.length + elseMatches.length + forMatches.length + whileMatches.length;
    complexity += repeatMatches.length + switchMatches.length + lapplyMatches.length;

    return complexity;
  }

  private calculateNestingDepth(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of content) {
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}') {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return maxDepth;
  }

  private countFunctions(content: string): number {
    const functionMatches = content.match(/\b\w+\s*<-\s*function\s*\(/g) || [];
    return functionMatches.length;
  }

  private complexityLevel(cyclomatic: number): 'low' | 'medium' | 'high' | 'critical' {
    if (cyclomatic <= 5) return 'low';
    if (cyclomatic <= 10) return 'medium';
    if (cyclomatic <= 15) return 'high';
    return 'critical';
  }

  private calculateComplexityScore(cyclomatic: number, nestingDepth: number, loc: number, functionCount: number): number {
    let score = 0;

    score += Math.min(cyclomatic * 10, 40);
    score += Math.min(nestingDepth * 8, 30);
    score += Math.min((loc / 100) * 20, 20);
    score -= Math.max((functionCount * 2), 0) * Math.min(1, functionCount);

    return Math.max(0, Math.min(100, score));
  }

  private aggregateMetrics(metrics: ComplexityMetric[]): ProjectComplexity {
    const highComplexityFiles = metrics.filter((m) => m.complexity === 'high' || m.complexity === 'critical').map((m) => m.file);

    const findings: ComplexityFinding[] = [];
    for (const metric of metrics) {
      if (metric.complexity === 'critical') {
        findings.push({
          file: metric.file,
          message: `Critical complexity score: ${metric.score.toFixed(1)} (Cyclomatic: ${metric.cyclomatic}, Max Nesting: ${metric.nestingDepth})`,
          severity: 'error',
          suggestion: 'Refactor into smaller functions and reduce nesting depth',
        });
      } else if (metric.complexity === 'high' && metric.cyclomatic > 10) {
        findings.push({
          file: metric.file,
          message: `High cyclomatic complexity: ${metric.cyclomatic}`,
          severity: 'warning',
          suggestion: 'Consider breaking this file into smaller functions',
        });
      } else if (metric.nestingDepth > 4) {
        findings.push({
          file: metric.file,
          message: `Excessive nesting depth: ${metric.nestingDepth}`,
          severity: 'warning',
          suggestion: 'Extract nested logic into helper functions',
        });
      }

      if (metric.linesOfCode > 500 && metric.commentPercentage < 0.1) {
        findings.push({
          file: metric.file,
          message: `Large file (${metric.linesOfCode} LOC) with minimal comments`,
          severity: 'warning',
          suggestion: 'Add documentation and consider splitting into multiple files',
        });
      }
    }

    return {
      totalFiles: metrics.length,
      averageComplexity: metrics.reduce((sum, m) => sum + m.score, 0) / Math.max(metrics.length, 1),
      maxComplexity: Math.max(...metrics.map((m) => m.score), 0),
      highComplexityFiles,
      totalLinesOfCode: metrics.reduce((sum, m) => sum + m.linesOfCode, 0),
      commentPercentage: metrics.reduce((sum, m) => sum + m.commentLines, 0) / Math.max(metrics.reduce((sum, m) => sum + m.linesOfCode, 0), 1),
      findings,
    };
  }

  // Helper to get comment percentage for a metric
  private getCommentPercentage(metric: ComplexityMetric): number {
    return metric.linesOfCode > 0 ? metric.commentLines / metric.linesOfCode : 0;
}
