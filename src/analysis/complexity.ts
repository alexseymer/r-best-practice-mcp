import { logger } from '../utils/logger.js';

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  nestingDepth: number;
  linesOfCode: number;
  commentRatio: number;
  functionCount: number;
  averageFunctionLength: number;
}

export interface FileComplexity {
  filePath: string;
  metrics: ComplexityMetrics;
  functions: Array<{
    name: string;
    startLine: number;
    endLine: number;
    complexity: number;
    length: number;
  }>;
}

export class ComplexityAnalyzer {
  analyzeFile(filePath: string, content: string): FileComplexity {
    const lines = content.split('\n');
    const metrics = this.calculateMetrics(content, lines);
    const functions = this.extractFunctions(content, lines);

    return {
      filePath,
      metrics,
      functions,
    };
  }

  private calculateMetrics(content: string, lines: string[]): ComplexityMetrics {
    const linesOfCode = this.countLinesOfCode(lines);
    const commentLines = this.countCommentLines(lines);
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(content);
    const nestingDepth = this.findMaxNestingDepth(content);
    const functionCount = this.countFunctions(content);

    return {
      cyclomaticComplexity,
      nestingDepth,
      linesOfCode,
      commentRatio: linesOfCode > 0 ? commentLines / linesOfCode : 0,
      functionCount,
      averageFunctionLength: functionCount > 0 ? linesOfCode / functionCount : linesOfCode,
    };
  }

  private countLinesOfCode(lines: string[]): number {
    return lines.filter((line) => line.trim().length > 0 && !line.trim().startsWith('#')).length;
  }

  private countCommentLines(lines: string[]): number {
    return lines.filter((line) => line.trim().startsWith('#')).length;
  }

  private calculateCyclomaticComplexity(content: string): number {
    let complexity = 1; // Base complexity

    // Count control flow statements
    const ifCount = (content.match(/\bif\s*\(/g) || []).length;
    const elseCount = (content.match(/\belse\s*(?:if)?\s*\(/g) || []).length;
    const forCount = (content.match(/\bfor\s*\(/g) || []).length;
    const whileCount = (content.match(/\bwhile\s*\(/g) || []).length;
    const repeatCount = (content.match(/\brepeat\s*\{/g) || []).length;
    const caseCount = (content.match(/\bcase\s+/g) || []).length;
    const andCount = (content.match(/&&|\band\b/g) || []).length;
    const orCount = (content.match(/\|\||\bor\b/g) || []).length;

    complexity +=
      ifCount + elseCount + forCount + whileCount + repeatCount + Math.max(0, caseCount - 1) + (andCount + orCount) / 2;

    return Math.max(1, complexity);
  }

  private findMaxNestingDepth(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}') {
        currentDepth--;
      }
    }

    return maxDepth;
  }

  private countFunctions(content: string): number {
    // Match function definitions: name <- function(...) or function(...)
    const functionPattern = /(?:[\w_.]+\s*<-\s*)?function\s*\(/g;
    const matches = content.match(functionPattern) || [];
    return matches.length;
  }

  private extractFunctions(
    content: string,
    lines: string[]
  ): Array<{ name: string; startLine: number; endLine: number; complexity: number; length: number }> {
    const functions: Array<{ name: string; startLine: number; endLine: number; complexity: number; length: number }> =
      [];

    // Find function definitions
    const functionRegex = /([\w_.]+)\s*<-\s*function\s*\(|function\s*\(/gm;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const startIndex = match.index;
      const startLine = content.substring(0, startIndex).split('\n').length;

      // Find matching closing brace
      let braceCount = 0;
      let foundStart = false;
      let endIndex = startIndex;

      for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') {
          braceCount++;
          foundStart = true;
        } else if (content[i] === '}' && foundStart) {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i;
            break;
          }
        }
      }

      const endLine = content.substring(0, endIndex).split('\n').length;
      const functionContent = content.substring(startIndex, endIndex);
      const complexity = this.calculateCyclomaticComplexity(functionContent);
      const functionName = match[1] || 'anonymous';

      functions.push({
        name: functionName,
        startLine,
        endLine,
        complexity,
        length: endLine - startLine + 1,
      });
    }

    return functions;
  }

  getSeverity(metrics: ComplexityMetrics): 'low' | 'medium' | 'high' {
    if (metrics.cyclomaticComplexity > 10 || metrics.nestingDepth > 5) {
      return 'high';
    }
    if (metrics.cyclomaticComplexity > 5 || metrics.nestingDepth > 3) {
      return 'medium';
    }
    return 'low';
  }

  getRecommendations(complexity: FileComplexity): string[] {
    const recommendations: string[] = [];
    const { metrics } = complexity;

    if (metrics.cyclomaticComplexity > 10) {
      recommendations.push('High cyclomatic complexity - consider breaking into smaller functions');
    }

    if (metrics.nestingDepth > 5) {
      recommendations.push('Deep nesting detected - consider refactoring to reduce nesting levels');
    }

    if (metrics.commentRatio < 0.1 && metrics.linesOfCode > 50) {
      recommendations.push('Low comment ratio - consider adding more documentation');
    }

    if (metrics.averageFunctionLength > 50) {
      recommendations.push('Functions are too long on average - consider breaking them into smaller units');
    }

    return recommendations;
  }
}
