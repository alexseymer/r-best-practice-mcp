import { Finding } from '../types';

export interface CodeFix {
  finding: Finding;
  originalCode: string;
  fixedCode: string;
  confidence: number;
  automatic: boolean;
}

export class AutomatedFixer {
  async fixFinding(finding: Finding, content: string, lines: string[]): Promise<CodeFix | null> {
    switch (finding.id) {
      case 'style-spaces':
        return this.fixSpacingAroundOperators(finding, content, lines);
      case 'naming-snake_case':
        return this.fixSnakeCasing(finding, content, lines);
      case 'practice-attach':
        return this.fixAttachUsage(finding, content, lines);
      case 'doc-roxygen':
        return this.addRoxygenDoc(finding, content, lines);
      default:
        return null;
    }
  }

  private fixSpacingAroundOperators(finding: Finding, content: string, lines: string[]): CodeFix | null {
    const line = lines[finding.line ? finding.line - 1 : 0];
    if (!line) return null;

    const originalCode = line;
    let fixedCode = line;

    // Fix spacing around operators
    fixedCode = fixedCode.replace(/(\w)([+\-*/])(\w)/g, '$1 $2 $3');
    fixedCode = fixedCode.replace(/(\w)([+\-*/])(\s)/g, '$1 $2$3');
    fixedCode = fixedCode.replace(/(\s)([+\-*/])(\w)/g, '$1$2 $3');

    return {
      finding,
      originalCode,
      fixedCode,
      confidence: 0.85,
      automatic: true,
    };
  }

  private fixSnakeCasing(finding: Finding, content: string, lines: string[]): CodeFix | null {
    const line = lines[finding.line ? finding.line - 1 : 0];
    if (!line) return null;

    const match = line.match(/^\s*([a-z][a-zA-Z]*)\s*<-\s*function\s*\(/);
    if (!match) return null;

    const originalCode = line;
    const functionName = match[1];

    // Convert camelCase to snake_case
    const snakeCased = functionName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');

    const fixedCode = line.replace(functionName, snakeCased);

    return {
      finding,
      originalCode,
      fixedCode,
      confidence: 0.9,
      automatic: true,
    };
  }

  private fixAttachUsage(finding: Finding, content: string, lines: string[]): CodeFix | null {
    const line = lines[finding.line ? finding.line - 1 : 0];
    if (!line) return null;

    const match = line.match(/attach\s*\((\w+)\)/);
    if (!match) return null;

    const originalCode = line;
    const dataframeName = match[1];

    // Suggest using with() instead
    const fixedCode = line.replace(match[0], `with(${dataframeName}, {`);

    return {
      finding,
      originalCode,
      fixedCode,
      confidence: 0.7,
      automatic: false, // Requires manual completion
    };
  }

  private addRoxygenDoc(finding: Finding, content: string, lines: string[]): CodeFix | null {
    const line = lines[finding.line ? finding.line - 1 : 0];
    if (!line) return null;

    const match = line.match(/^(\s*)(\w+)\s*<-\s*function\s*\((.*?)\)\s*\{/);
    if (!match) return null;

    const indent = match[1];
    const functionName = match[2];
    const params = match[3].split(',').map((p) => p.trim().split('=')[0]);

    let doc = `${indent}#' ${functionName}\n`;
    doc += `${indent}#'\n`;
    for (const param of params) {
      if (param) {
        doc += `${indent}#' @param ${param} Description of ${param}\n`;
      }
    }
    doc += `${indent}#' @return Description of return value\n`;
    doc += `${indent}#' @export\n`;

    const originalCode = line;
    const fixedCode = doc + line;

    return {
      finding,
      originalCode,
      fixedCode,
      confidence: 0.6,
      automatic: false, // Requires manual parameter descriptions
    };
  }

  applyFix(content: string, fix: CodeFix, lineNumber?: number): string {
    const lines = content.split('\n');
    const targetLine = lineNumber || fix.finding.line || 1;

    if (targetLine > 0 && targetLine <= lines.length) {
      lines[targetLine - 1] = fix.fixedCode;
    }

    return lines.join('\n');
  }

  generateFixSuggestion(finding: Finding): string {
    const suggestions: Record<string, string> = {
      'style-spaces': 'Add spaces around operators for better readability',
      'naming-snake_case': 'Rename function to use snake_case convention',
      'practice-attach': 'Replace attach() with with() for safer scoping',
      'doc-roxygen': 'Add roxygen2 documentation for the function',
      'practice-rm-all': 'Use selective object removal or restart R session',
      'security-eval': 'Consider using substitute() or other safe alternatives',
      'security-system': 'Use processx package for safer process execution',
    };

    return suggestions[finding.id] || 'Apply suggested fix to improve code quality';
  }
}
