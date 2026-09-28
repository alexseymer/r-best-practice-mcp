import * as fs from 'fs';
import * as path from 'path';
import { FileUtils } from '../utils/file';

export type RuleType = 'regex' | 'function' | 'structure' | 'naming' | 'documentation';
export type RuleSeverity = 'info' | 'recommended' | 'important' | 'critical';

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  pattern?: string | RegExp;
  test?: (content: string) => boolean;
  applies?: 'all' | 'packages' | 'scripts' | 'analyses' | 'shiny' | 'quarto';
  severity: RuleSeverity;
  message: string;
  suggestion: string;
  enabled: boolean;
  tags?: string[];
}

export interface RuleViolation {
  ruleId: string;
  file: string;
  line?: number;
  message: string;
  suggestion: string;
  severity: RuleSeverity;
  match?: string;
}

export class CustomRuleEngine {
  private rules: Map<string, CustomRule> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Naming conventions
    this.addRule({
      id: 'naming-snake_case',
      name: 'Snake Case Functions',
      description: 'Function names should use snake_case',
      type: 'naming',
      pattern: /^\s*([a-z][a-zA-Z]*)\s*<-\s*function\s*\(/,
      severity: 'recommended',
      message: 'Function names should use snake_case',
      suggestion: 'Use snake_case for function names (e.g., my_function)',
      enabled: true,
      tags: ['naming', 'style'],
    });

    // Function length
    this.addRule({
      id: 'function-length',
      name: 'Function Length',
      description: 'Functions should not exceed 50 lines',
      type: 'function',
      test: (content: string) => {
        const functions = content.match(/\w+\s*<-\s*function\s*\([\s\S]*?\n\}/g) || [];
        return functions.some((fn) => fn.split('\n').length > 50);
      },
      severity: 'important',
      message: 'Function exceeds recommended length of 50 lines',
      suggestion: 'Consider breaking the function into smaller, focused functions',
      enabled: true,
      tags: ['complexity', 'maintainability'],
    });

    // Documentation
    this.addRule({
      id: 'doc-roxygen',
      name: 'Roxygen Documentation',
      description: 'Functions should have roxygen2 documentation',
      type: 'documentation',
      applies: 'packages',
      test: (content: string) => {
        const functions = content.match(/\w+\s*<-\s*function\s*\(/g) || [];
        const docs = content.match(/#' @\w+/g) || [];
        return functions.length > 0 && docs.length === 0;
      },
      severity: 'important',
      message: 'Function lacks roxygen2 documentation',
      suggestion: 'Add roxygen2 documentation above the function definition',
      enabled: true,
      tags: ['documentation', 'package'],
    });

    // Code style
    this.addRule({
      id: 'style-spaces',
      name: 'Spacing Around Operators',
      description: 'Operators should be surrounded by spaces',
      type: 'regex',
      pattern: /\w[\+\-\*/](?!\s)|\s[\+\-\*/]\w/,
      severity: 'recommended',
      message: 'Missing spaces around operators',
      suggestion: 'Add spaces around operators (e.g., x + y instead of x+y)',
      enabled: true,
      tags: ['style', 'formatting'],
    });

    // Security
    this.addRule({
      id: 'security-eval',
      name: 'Avoid eval()',
      description: 'Avoid using eval() function',
      type: 'regex',
      pattern: /\beval\s*\(/,
      severity: 'critical',
      message: 'Use of eval() is not recommended',
      suggestion: 'Consider using substitute() or other metaprogramming approaches',
      enabled: true,
      tags: ['security', 'best-practices'],
    });

    this.addRule({
      id: 'security-system',
      name: 'Avoid system()',
      description: 'Avoid using system() for external commands',
      type: 'regex',
      pattern: /\bsystem\s*\(['"]/,
      severity: 'important',
      message: 'Direct system() calls may be a security risk',
      suggestion: 'Consider using processx package for safer process execution',
      enabled: true,
      tags: ['security', 'best-practices'],
    });

    // Best practices
    this.addRule({
      id: 'practice-attach',
      name: 'Avoid attach()',
      description: 'Avoid using attach() function',
      type: 'regex',
      pattern: /\battach\s*\(/,
      severity: 'important',
      message: 'Use of attach() is discouraged',
      suggestion: 'Use explicit $ notation or with() instead',
      enabled: true,
      tags: ['best-practices', 'scoping'],
    });

    this.addRule({
      id: 'practice-rm-all',
      name: 'Avoid rm(list=ls())',
      description: 'Avoid clearing entire environment',
      type: 'regex',
      pattern: /\brm\s*\(\s*list\s*=\s*ls\s*\(\s*\)/,
      severity: 'recommended',
      message: 'Clearing entire environment can cause unexpected behavior',
      suggestion: 'Restart R session instead, or selectively remove objects',
      enabled: true,
      tags: ['best-practices', 'environment'],
    });

    // Testing
    this.addRule({
      id: 'testing-presence',
      name: 'Package Testing',
      description: 'Packages should have tests',
      type: 'structure',
      applies: 'packages',
      test: (content: string) => false, // Checked at project level
      severity: 'important',
      message: 'Package lacks a tests directory',
      suggestion: 'Create tests/testthat/ directory with test files',
      enabled: true,
      tags: ['testing', 'package'],
    });
  }

  addRule(rule: CustomRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  async applyRules(filePath: string, content: string, workflow?: string): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];
    const lines = content.split('\n');

    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;
      if (rule.applies && rule.applies !== 'all' && rule.applies !== workflow) continue;

      const ruleViolations = this.checkRule(filePath, content, lines, rule);
      violations.push(...ruleViolations);
    }

    return violations;
  }

  private checkRule(filePath: string, content: string, lines: string[], rule: CustomRule): RuleViolation[] {
    const violations: RuleViolation[] = [];

    if (rule.type === 'regex' && rule.pattern) {
      const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'g') : rule.pattern;
      lines.forEach((line, index) => {
        const match = line.match(pattern);
        if (match) {
          violations.push({
            ruleId: rule.id,
            file: filePath,
            line: index + 1,
            message: rule.message,
            suggestion: rule.suggestion,
            severity: rule.severity,
            match: match[0],
          });
        }
      });
    } else if (rule.type === 'function' && rule.test) {
      if (rule.test(content)) {
        violations.push({
          ruleId: rule.id,
          file: filePath,
          message: rule.message,
          suggestion: rule.suggestion,
          severity: rule.severity,
        });
      }
    }

    return violations;
  }

  getRules(): CustomRule[] {
    return Array.from(this.rules.values());
  }

  getRulesByTag(tag: string): CustomRule[] {
    return Array.from(this.rules.values()).filter((rule) => rule.tags?.includes(tag));
  }

  async loadCustomRules(projectPath: string): Promise<void> {
    const rulesPath = path.join(projectPath, '.r-best-practices-rules.json');
    if (!(await FileUtils.exists(rulesPath))) {
      return;
    }

    try {
      const content = await FileUtils.readFile(rulesPath);
      const customRules = JSON.parse(content) as CustomRule[];
      for (const rule of customRules) {
        this.addRule(rule);
      }
    } catch (error) {
      console.warn(`Failed to load custom rules: ${error}`);
    }
  }

  async saveCustomRules(projectPath: string, rules: CustomRule[]): Promise<void> {
    const rulesPath = path.join(projectPath, '.r-best-practices-rules.json');
    const content = JSON.stringify(rules, null, 2);
    await FileUtils.writeFile(rulesPath, content);
  }
}
