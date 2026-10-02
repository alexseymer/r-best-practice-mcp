import { Practice, PracticeListOptions, PracticeQueryResult } from '../types/practice.js';
import { Workflow } from '../types/workflow.js';
import { Severity } from '../types/finding.js';
import { logger } from '../utils/logger.js';
import { ALL_PRACTICES } from './practices/index.js';

export class KnowledgeBase {
  private practices: Practice[] = [];
  private indexByWorkflow: Map<Workflow, Practice[]> = new Map();
  private indexById: Map<string, Practice> = new Map();

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    logger.info('Initializing Knowledge Base');
    this.loadPractices();
  }

  private loadPractices(): void {
    // Expanded knowledge base with 100+ best practices
    const practices: Practice[] = [...ALL_PRACTICES];

    // Index practices
    for (const practice of practices) {
      this.indexById.set(practice.id, practice);

      if (!this.indexByWorkflow.has(practice.workflow)) {
        this.indexByWorkflow.set(practice.workflow, []);
      }
      this.indexByWorkflow.get(practice.workflow)!.push(practice);
    }

    this.practices = practices;
    logger.info(`Loaded ${practices.length} practices`);
  }

  getPractice(id: string): Practice | undefined {
    return this.indexById.get(id);
  }

  listPractices(options: PracticeListOptions = {}): PracticeQueryResult {
    let results = [...this.practices];

    // Filter by workflow
    if (options.workflow) {
      results = results.filter((p) => p.workflow === options.workflow);
    }

    // Filter by category
    if (options.category) {
      results = results.filter((p) => p.category === options.category);
    }

    // Filter by severity
    if (options.severity) {
      const severityOrder: Record<Severity, number> = {
        critical: 4,
        important: 3,
        recommended: 2,
        info: 1,
      };
      const minSeverityValue = severityOrder[options.severity];
      results = results.filter((p) => severityOrder[p.severity] >= minSeverityValue);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter((p) =>
        p.tags?.some((tag) => options.tags!.includes(tag))
      );
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return {
      practices: results,
      total: results.length,
      timestamp: Date.now(),
    };
  }

  searchPractices(query: string): PracticeQueryResult {
    const queryLower = query.toLowerCase();
    const results = this.practices.filter(
      (p) =>
        p.title.toLowerCase().includes(queryLower) ||
        p.description.toLowerCase().includes(queryLower) ||
        p.tags?.some((tag) => tag.toLowerCase().includes(queryLower))
    );

    return {
      practices: results,
      total: results.length,
      timestamp: Date.now(),
    };
  }

  getWorkflows(): Workflow[] {
    return Array.from(this.indexByWorkflow.keys());
  }

  getPracticeCountByWorkflow(): Record<Workflow, number> {
    const counts: Record<Workflow, number> = {} as Record<Workflow, number>;
    for (const [workflow, practices] of this.indexByWorkflow) {
      counts[workflow] = practices.length;
    }
    return counts;
  }
}

export const kb = new KnowledgeBase();
