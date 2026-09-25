import { Practice, PracticeListOptions, PracticeQueryResult } from '../types/practice.js';
import { Workflow } from '../types/workflow.js';
import { Category, Severity } from '../types/finding.js';
import { logger } from '../utils/logger.js';

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
    // Phase 1: Core practices for R Scripts and Quarto
    const practices: Practice[] = [
      // R Script practices
      {
        id: 'rscript-header',
        title: 'Include header comment with metadata',
        workflow: 'r-script',
        category: 'documentation',
        severity: 'recommended',
        description:
          'R scripts should start with a header comment including purpose, author, and date',
        goodExample:
          '# Purpose: Data processing for analysis\n# Author: Jane Doe\n# Date: 2024-01-15',
        badExample: '# My script\ndata <- read.csv("file.csv")',
        tags: ['header', 'documentation', 'script'],
      },
      {
        id: 'rscript-naming',
        title: 'Use snake_case for script filenames',
        workflow: 'r-script',
        category: 'naming',
        severity: 'recommended',
        description:
          'Script filenames should use snake_case for consistency and readability',
        goodExample: 'data_cleaning.R, analysis_report.R',
        badExample: 'DataCleaning.R, analysisReport.R',
        tags: ['naming', 'convention', 'script'],
      },
      {
        id: 'rscript-functions',
        title: 'Extract reusable logic into functions',
        workflow: 'r-script',
        category: 'structure',
        severity: 'important',
        description:
          'Avoid duplicating code; extract repeated logic into well-named functions',
        tags: ['function', 'refactor', 'maintainability'],
      },

      // Quarto practices
      {
        id: 'quarto-labels',
        title: 'Use descriptive code chunk labels',
        workflow: 'quarto',
        category: 'structure',
        severity: 'recommended',
        description:
          'Every code chunk should have a clear, descriptive label for tracking and reference',
        goodExample:
          '```{r}\n#| label: load-data\ndata <- read.csv("file.csv")\n```',
        badExample: '```{r}\ndata <- read.csv("file.csv")\n```',
        tags: ['chunk', 'label', 'quarto'],
      },
      {
        id: 'quarto-options',
        title: 'Explicitly set chunk options',
        workflow: 'quarto',
        category: 'structure',
        severity: 'recommended',
        description:
          'Use #| echo, #| eval, #| warning, #| message options for clarity',
        goodExample:
          '```{r}\n#| echo: true\n#| warning: false\n#| message: false\n```',
        badExample: '```{r}\nprint("output")\n```',
        tags: ['chunk', 'options', 'quarto'],
      },
      {
        id: 'quarto-yaml',
        title: 'Include YAML frontmatter with metadata',
        workflow: 'quarto',
        category: 'documentation',
        severity: 'recommended',
        description:
          'Quarto documents should include YAML frontmatter with title, author, date',
        goodExample:
          '---\ntitle: "Analysis Report"\nauthor: "Jane Doe"\ndate: 2024-01-15\nformat: html\n---',
        tags: ['yaml', 'metadata', 'quarto'],
      },

      // Shiny practices
      {
        id: 'shiny-separation',
        title: 'Separate UI and server logic',
        workflow: 'shiny',
        category: 'structure',
        severity: 'important',
        description:
          'Use ui.R and server.R files or clearly separate sections in app.R',
        tags: ['shiny', 'structure', 'maintainability'],
      },
      {
        id: 'shiny-reactive',
        title: 'Use reactive() appropriately',
        workflow: 'shiny',
        category: 'performance',
        severity: 'important',
        description:
          'Avoid unnecessary recomputation by using reactive() and observe() properly',
        tags: ['reactive', 'performance', 'shiny'],
      },

      // Package practices
      {
        id: 'pkg-roxygen',
        title: 'Use roxygen2 for function documentation',
        workflow: 'package',
        category: 'documentation',
        severity: 'important',
        description: 'Document functions with roxygen2 comments (@param, @return, @export)',
        tags: ['roxygen', 'documentation', 'package'],
      },
      {
        id: 'pkg-description',
        title: 'Maintain accurate DESCRIPTION file',
        workflow: 'package',
        category: 'structure',
        severity: 'critical',
        description:
          'DESCRIPTION file must accurately reflect package metadata and dependencies',
        tags: ['description', 'metadata', 'package'],
      },
      {
        id: 'pkg-tests',
        title: 'Include tests in tests/testthat/',
        workflow: 'package',
        category: 'testing',
        severity: 'important',
        description: 'Use testthat for unit testing R package functions',
        tags: ['testing', 'testthat', 'package'],
      },

      // R Markdown practices
      {
        id: 'rmd-yaml',
        title: 'Include YAML header with output format',
        workflow: 'rmarkdown',
        category: 'documentation',
        severity: 'recommended',
        description: 'R Markdown files should have YAML frontmatter specifying output format',
        tags: ['yaml', 'header', 'rmarkdown'],
      },
      {
        id: 'rmd-chunks',
        title: 'Use labeled code chunks',
        workflow: 'rmarkdown',
        category: 'structure',
        severity: 'recommended',
        description: 'Give each chunk a meaningful name for navigation',
        tags: ['chunk', 'label', 'rmarkdown'],
      },

      // renv practices
      {
        id: 'renv-init',
        title: 'Initialize renv for project',
        workflow: 'renv',
        category: 'dependency',
        severity: 'important',
        description: 'Run renv::init() at project start to create renv.lock',
        tags: ['renv', 'dependency', 'initialization'],
      },
      {
        id: 'renv-lock',
        title: 'Track renv.lock in version control',
        workflow: 'renv',
        category: 'structure',
        severity: 'critical',
        description: 'Commit renv.lock to git for reproducibility',
        tags: ['renv', 'version-control', 'reproducibility'],
      },

      // targets practices
      {
        id: 'targets-structure',
        title: 'Organize targets in _targets.R',
        workflow: 'targets',
        category: 'structure',
        severity: 'recommended',
        description: 'Define all targets in _targets.R with clear dependencies',
        tags: ['targets', 'pipeline', 'structure'],
      },
      {
        id: 'targets-naming',
        title: 'Use snake_case for target names',
        workflow: 'targets',
        category: 'naming',
        severity: 'recommended',
        description: 'Target names should follow snake_case convention',
        tags: ['targets', 'naming', 'convention'],
      },

      // Plumber practices
      {
        id: 'plumber-paths',
        title: 'Use clear, RESTful paths',
        workflow: 'plumber',
        category: 'structure',
        severity: 'recommended',
        description: 'Plumber endpoints should follow REST conventions',
        tags: ['plumber', 'api', 'rest'],
      },
      {
        id: 'plumber-validation',
        title: 'Validate and sanitize all inputs',
        workflow: 'plumber',
        category: 'security',
        severity: 'critical',
        description: 'Always validate user input to prevent injection attacks',
        tags: ['plumber', 'security', 'validation'],
      },
    ];

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
