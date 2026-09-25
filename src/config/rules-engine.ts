import { logger } from '../utils/logger.js';

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  workflow?: string;
  pattern: string; // Regex pattern
  severity: 'critical' | 'important' | 'recommended' | 'info';
  category: string;
  message: string;
  suggestion?: string;
  enabled: boolean;
}

export interface RulesConfig {
  rules: CustomRule[];
  version: string;
}

export class RulesEngine {
  private rules: CustomRule[] = [];
  private rulesByWorkflow: Map<string, CustomRule[]> = new Map();

  constructor(config?: RulesConfig) {
    if (config) {
      this.loadRules(config.rules);
    }
  }

  private loadRules(rules: CustomRule[]): void {
    this.rules = rules.filter((r) => r.enabled);

    // Index rules by workflow
    this.rulesByWorkflow.clear();
    for (const rule of this.rules) {
      if (rule.workflow) {
        if (!this.rulesByWorkflow.has(rule.workflow)) {
          this.rulesByWorkflow.set(rule.workflow, []);
        }
        this.rulesByWorkflow.get(rule.workflow)!.push(rule);
      } else {
        // Global rules apply to all workflows
        for (const key of ['r-script', 'quarto', 'shiny', 'package', 'rmarkdown', 'renv', 'targets', 'plumber', 'analysis']) {
          if (!this.rulesByWorkflow.has(key)) {
            this.rulesByWorkflow.set(key, []);
          }
          this.rulesByWorkflow.get(key)!.push(rule);
        }
      }
    }

    logger.info(`Loaded ${this.rules.length} custom rules`);
  }

  getRulesForWorkflow(workflow: string): CustomRule[] {
    return this.rulesByWorkflow.get(workflow) || [];
  }

  checkContent(content: string, workflow: string): Array<{
    ruleId: string;
    matches: Array<{ start: number; end: number; text: string }>;
  }> {
    const results: Array<{ ruleId: string; matches: Array<{ start: number; end: number; text: string }> }> = [];
    const rules = this.getRulesForWorkflow(workflow);

    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.pattern, 'gm');
        const matches: Array<{ start: number; end: number; text: string }> = [];
        let match;

        while ((match = regex.exec(content)) !== null) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
          });
        }

        if (matches.length > 0) {
          results.push({
            ruleId: rule.id,
            matches,
          });
        }
      } catch (error) {
        logger.warn(`Invalid regex pattern in rule ${rule.id}: ${error}`);
      }
    }

    return results;
  }

  addRule(rule: CustomRule): void {
    this.rules.push(rule);
    if (rule.enabled) {
      const key = rule.workflow || 'global';
      if (!this.rulesByWorkflow.has(key)) {
        this.rulesByWorkflow.set(key, []);
      }
      this.rulesByWorkflow.get(key)!.push(rule);
    }
  }

  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);

      // Remove from workflow map
      for (const workflowRules of this.rulesByWorkflow.values()) {
        const idx = workflowRules.findIndex((r) => r.id === ruleId);
        if (idx >= 0) {
          workflowRules.splice(idx, 1);
        }
      }
      return true;
    }
    return false;
  }

  enableRule(ruleId: string): boolean {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = true;
      this.loadRules(this.rules);
      return true;
    }
    return false;
  }

  disableRule(ruleId: string): boolean {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = false;
      this.loadRules(this.rules);
      return true;
    }
    return false;
  }

  exportConfig(): RulesConfig {
    return {
      version: '1.0.0',
      rules: this.rules,
    };
  }
}
