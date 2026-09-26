import { logger } from '../utils/logger.js';

export interface AutoFix {
  id: string;
  findingId: string;
  description: string;
  transformFunction: (content: string, line?: number) => string;
}

export interface FixResult {
  applied: boolean;
  before: string;
  after: string;
  description: string;
}

export class AutoFixesEngine {
  private fixes: Map<string, AutoFix> = new Map();

  constructor() {
    this.registerDefaultFixes();
  }

  private registerDefaultFixes(): void {
    // Fix: Missing function documentation
    this.registerFix({
      id: 'add-function-docs',
      findingId: 'func-missing-docs',
      description: 'Add roxygen2 documentation template',
      transformFunction: (content: string, line?: number) => {
        if (!line) return content;

        const lines = content.split('\n');
        const functionLine = lines[line - 1];

        if (functionLine && functionLine.includes('function(')) {
          const functionName = functionLine.match(/(\w+)\s*<-\s*function/)?.[1] || 'my_function';

          const docTemplate = `#' ${functionName}
#'
#' @description Brief description
#'
#' @param x Parameter description
#'
#' @return Description of return value
#'
#' @export
#'
#' @examples
#' ${functionName}(1)
`;

          lines.splice(line - 1, 0, docTemplate);
          return lines.join('\n');
        }

        return content;
      },
    });

    // Fix: Add library call at top
    this.registerFix({
      id: 'add-library',
      findingId: 'missing-library',
      description: 'Add library() call at beginning of script',
      transformFunction: (content: string) => {
        const packageMatch = content.match(/(?:library|require)\s*\(\s*['"]?(\w+)/);
        if (!packageMatch) return content;

        const packageName = packageMatch[1];
        const libraryCall = `library(${packageName})\n`;

        // Insert after any existing comments or roxygen
        const lines = content.split('\n');
        let insertIndex = 0;

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('#')) continue;
          insertIndex = i;
          break;
        }

        lines.splice(insertIndex, 0, libraryCall);
        return lines.join('\n');
      },
    });

    // Fix: Remove trailing whitespace
    this.registerFix({
      id: 'remove-trailing-whitespace',
      findingId: 'trailing-whitespace',
      description: 'Remove trailing whitespace',
      transformFunction: (content: string) => {
        return content
          .split('\n')
          .map((line) => line.trimEnd())
          .join('\n');
      },
    });

    // Fix: Add missing braces
    this.registerFix({
      id: 'add-braces',
      findingId: 'missing-braces',
      description: 'Add braces around single statements',
      transformFunction: (content: string, line?: number) => {
        if (!line) return content;

        const lines = content.split('\n');
        const currentLine = lines[line - 1];

        // Match if/for/while without braces
        const match = currentLine.match(/^(\s*)(if|for|while)\s*\([^)]*\)\s*(.+)$/);
        if (match && !currentLine.includes('{')) {
          const [, indent, keyword, statement] = match;
          lines[line - 1] = `${indent}${keyword} (...) {`;
          lines.splice(line, 0, `${indent}  ${statement}`);
          lines.splice(line + 1, 0, `${indent}}`);
        }

        return lines.join('\n');
      },
    });

    // Fix: Standardize assignment operator
    this.registerFix({
      id: 'standardize-assignment',
      findingId: 'non-standard-assignment',
      description: 'Convert = to <- for assignment',
      transformFunction: (content: string) => {
        // Simple approach: replace = with <- outside of function calls
        return content.replace(/(\w+)\s*=\s*([^=])/g, '$1 <- $2');
      },
    });

    // Fix: Add namespace to function calls
    this.registerFix({
      id: 'add-namespace',
      findingId: 'missing-namespace',
      description: 'Add package namespace to function call',
      transformFunction: (content: string) => {
        // This would need more context to implement properly
        return content;
      },
    });
  }

  registerFix(fix: AutoFix): void {
    this.fixes.set(fix.id, fix);
    logger.info(`Registered auto-fix: ${fix.id}`);
  }

  applyFix(fixId: string, content: string, line?: number): FixResult | null {
    const fix = this.fixes.get(fixId);
    if (!fix) {
      logger.warn(`Auto-fix not found: ${fixId}`);
      return null;
    }

    try {
      const after = fix.transformFunction(content, line);
      return {
        applied: after !== content,
        before: content,
        after,
        description: fix.description,
      };
    } catch (error) {
      logger.error(`Error applying auto-fix ${fixId}:`, error);
      return null;
    }
  }

  canAutoFix(findingId: string): boolean {
    return Array.from(this.fixes.values()).some((fix) => fix.findingId === findingId);
  }

  getFixFor(findingId: string): AutoFix | undefined {
    return Array.from(this.fixes.values()).find((fix) => fix.findingId === findingId);
  }

  getAllFixes(): AutoFix[] {
    return Array.from(this.fixes.values());
  }

  batchApplyFixes(content: string, fixes: Array<{ fixId: string; line?: number }>): string {
    let result = content;

    for (const fixRequest of fixes) {
      const fixResult = this.applyFix(fixRequest.fixId, result, fixRequest.line);
      if (fixResult?.applied) {
        result = fixResult.after;
      }
    }

    return result;
  }
}
