import { FileUtils } from '../utils/file';

export interface PerformanceIssue {
  file: string;
  line?: number;
  pattern: string;
  issue: string;
  severity: 'info' | 'warning' | 'error';
  suggestion: string;
  example?: string;
}

export interface PerformanceAnalysis {
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  issues: PerformanceIssue[];
  summary: string;
}

export class PerformanceAnalyzer {
  async analyzeProject(projectPath: string): Promise<PerformanceAnalysis> {
    const rFiles = await FileUtils.listFiles(projectPath, '**/*.R', true);
    const issues: PerformanceIssue[] = [];

    for (const file of rFiles) {
      try {
        const content = await FileUtils.readFile(file);
        const fileIssues = this.analyzeFile(file, content);
        issues.push(...fileIssues);
      } catch (error) {
        console.warn(`Failed to analyze ${file}: ${error}`);
      }
    }

    return this.generateAnalysis(issues);
  }

  private analyzeFile(filePath: string, content: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    issues.push(...this.checkVectorization(filePath, lines));
    issues.push(...this.checkMemoryUsage(filePath, lines));
    issues.push(...this.checkLoops(filePath, lines));
    issues.push(...this.checkApply(filePath, lines));

    return issues;
  }

  private checkVectorization(filePath: string, lines: string[]): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    lines.forEach((line, index) => {
      // Check for vector recycling warnings
      if (/\+\s*rep\(|c\(.*\)\s*\*|c\(.*\)\s*\/|\[i\].*\[j\]/.test(line)) {
        if (/for\s*\(.*in/.test(lines.slice(Math.max(0, index - 5), index).join('\n'))) {
          issues.push({
            file: filePath,
            line: index + 1,
            pattern: 'vector recycling in loop',
            issue: 'Potential vector recycling that could be vectorized',
            severity: 'warning',
            suggestion: 'Consider using vector operations instead of loops',
            example: 'Bad: for(i in 1:n) result[i] <- x[i] + y[i]\nGood: result <- x + y',
          });
        }
      }

      // Check for inefficient sequence operations
      if (/for\s*\(\s*i\s+in\s+1:length\(|for\s*\(\s*i\s+in\s+seq_along\(/.test(line)) {
        if (/\[i\]/.test(lines.slice(index, Math.min(lines.length, index + 10)).join('\n'))) {
          issues.push({
            file: filePath,
            line: index + 1,
            pattern: 'inefficient sequence loop',
            issue: 'Loop over sequence that could use vectorized operations',
            severity: 'warning',
            suggestion: 'Consider using lapply, sapply, or direct vector operations',
            example: 'Bad: for(i in seq_along(x)) y[i] <- x[i]^2\nGood: y <- x^2',
          });
        }
      }
    });

    return issues;
  }

  private checkMemoryUsage(filePath: string, lines: string[]): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    lines.forEach((line, index) => {
      // Check for large object creation in loops
      if (/matrix\(|data\.frame\(|list\(|array\(/.test(line)) {
        if (/for\s*\(/.test(lines.slice(Math.max(0, index - 10), index).join('\n'))) {
          if (!/pre.*alloc|vector\(|list\(length/.test(lines.slice(Math.max(0, index - 5), index).join('\n'))) {
            issues.push({
              file: filePath,
              line: index + 1,
              pattern: 'object creation in loop',
              issue: 'Creating objects inside loop without pre-allocation',
              severity: 'warning',
              suggestion: 'Pre-allocate objects before the loop to improve performance',
              example: 'Bad: for(i in 1:n) { x <- c(x, value) }\nGood: x <- vector("list", n); for(i in 1:n) { x[[i]] <- value }',
            });
          }
        }
      }

      // Check for rbind/cbind in loops
      if (/rbind\(|cbind\(/.test(line)) {
        if (/for\s*\(/.test(lines.slice(Math.max(0, index - 10), index).join('\n'))) {
          issues.push({
            file: filePath,
            line: index + 1,
            pattern: 'rbind/cbind in loop',
            issue: 'Using rbind/cbind inside loop is inefficient',
            severity: 'error',
            suggestion: 'Collect results in a list and combine once after the loop',
            example: 'Bad: for(i in 1:n) { df <- rbind(df, new_row) }\nGood: rows <- lapply(1:n, create_row); do.call(rbind, rows)',
          });
        }
      }
    });

    return issues;
  }

  private checkLoops(filePath: string, lines: string[]): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    let loopDepth = 0;

    lines.forEach((line, index) => {
      // Track nested loop depth
      if (/for\s*\(|while\s*\(|repeat\s*\{/.test(line)) {
        loopDepth++;

        if (loopDepth >= 3) {
          issues.push({
            file: filePath,
            line: index + 1,
            pattern: 'deeply nested loops',
            issue: `Deeply nested loops (depth: ${loopDepth}) may impact performance`,
            severity: 'warning',
            suggestion: 'Consider refactoring into separate functions or using vectorized operations',
            example: 'Consider using outer(), expand.grid(), or matrix operations instead',
          });
        }
      }

      if (/\}/.test(line)) {
        loopDepth = Math.max(0, loopDepth - 1);
      }

      // Check for expensive operations in loops
      if (/paste\(|strsplit\(|grep\(|sub\(|match\(/.test(line)) {
        if (/for\s*\(/.test(lines.slice(Math.max(0, index - 5), index).join('\n'))) {
          issues.push({
            file: filePath,
            line: index + 1,
            pattern: 'expensive string operations in loop',
            issue: 'String operations inside loop can be slow',
            severity: 'warning',
            suggestion: 'Use vectorized string functions or move operations outside loop',
            example: 'Bad: for(x in vec) { result <- c(result, paste(x, suffix)) }\nGood: result <- paste(vec, suffix)',
          });
        }
      }
    });

    return issues;
  }

  private checkApply(filePath: string, lines: string[]): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    lines.forEach((line, index) => {
      // Check for inefficient apply usage
      if (/apply\(\s*\w+,\s*1/.test(line) || /apply\(\s*\w+,\s*2/.test(line)) {
        if (/paste\(|substr\(|nchar\(/.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            pattern: 'apply with string operations',
            issue: 'Using apply() for string operations that could be vectorized',
            severity: 'info',
            suggestion: 'Consider using gsub(), strsplit(), or stringr functions directly on the vector',
            example: 'Bad: apply(matrix, 1, substr, 1, 5)\nGood: substr(matrix, 1, 5)',
          });
        }
      }

      // Check for inefficient mapply
      if (/mapply\(|Map\(/.test(line)) {
        if (!/simplify\s*=\s*FALSE|USE.NAMES\s*=\s*FALSE/.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            pattern: 'inefficient mapply',
            issue: 'mapply() without simplify=FALSE may create unnecessary overhead',
            severity: 'info',
            suggestion: 'Set simplify=FALSE if you need a list result',
          });
        }
      }
    });

    return issues;
  }

  private generateAnalysis(issues: PerformanceIssue[]): PerformanceAnalysis {
    const critical = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;

    let summary = `Found ${issues.length} performance issues: `;
    if (critical > 0) {
      summary += `${critical} critical, `;
    }
    summary += `${warnings} warning${warnings === 1 ? '' : 's'}`;

    return {
      totalIssues: issues.length,
      criticalIssues: critical,
      warningIssues: warnings,
      issues,
      summary,
    };
  }
}
