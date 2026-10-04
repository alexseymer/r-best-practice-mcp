import { Practice, PracticeListOptions, PracticeQueryResult } from '../types/practice.js';
import { Workflow } from '../types/workflow.js';
import { SEVERITY_RANK } from '../engine/finding-filters.js';
import { logger } from '../utils/logger.js';
import { ALL_PRACTICES } from './practices/index.js';

/** Case-insensitive substring match over id, title, description, details and tags. */
function practiceMatchesQuery(p: Practice, lowerNeedle: string): boolean {
  return (
    p.id.toLowerCase().includes(lowerNeedle) ||
    p.title.toLowerCase().includes(lowerNeedle) ||
    p.description.toLowerCase().includes(lowerNeedle) ||
    (p.details?.toLowerCase().includes(lowerNeedle) ?? false) ||
    (p.tags?.some((tag) => tag.toLowerCase().includes(lowerNeedle)) ?? false)
  );
}

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

    // Filter by minimum severity
    if (options.minSeverity) {
      const minRank = SEVERITY_RANK[options.minSeverity];
      results = results.filter((p) => SEVERITY_RANK[p.severity] >= minRank);
    }

    // Filter by enforcement type
    if (options.enforcement) {
      results = results.filter((p) => p.enforcement === options.enforcement);
    }

    // Free-text query
    if (options.query && options.query.trim()) {
      const needle = options.query.trim().toLowerCase();
      results = results.filter((p) => practiceMatchesQuery(p, needle));
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter((p) => p.tags?.some((tag) => options.tags!.includes(tag)));
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
    return this.listPractices({ query });
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
