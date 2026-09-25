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
    // Expanded knowledge base with 100+ best practices
    const practices: Practice[] = [
      // ============== R SCRIPTS ==============
      {
        id: 'rscript-header',
        title: 'Include header comment with metadata',
        workflow: 'r-script',
        category: 'documentation',
        severity: 'recommended',
        description: 'Script should start with header including purpose, author, date',
        tags: ['header', 'documentation'],
      },
      {
        id: 'rscript-naming',
        title: 'Use snake_case for script filenames',
        workflow: 'r-script',
        category: 'naming',
        severity: 'recommended',
        description: 'Script filenames should use snake_case (e.g., data_cleaning.R)',
        tags: ['naming', 'convention'],
      },
      {
        id: 'rscript-functions',
        title: 'Extract reusable logic into functions',
        workflow: 'r-script',
        category: 'structure',
        severity: 'important',
        description: 'Avoid code duplication; extract repeated logic into functions',
        tags: ['function', 'refactor'],
      },
      {
        id: 'rscript-sections',
        title: 'Organize script with clear sections',
        workflow: 'r-script',
        category: 'structure',
        severity: 'recommended',
        description: 'Use comment headers to divide script into logical sections',
        tags: ['organization', 'readability'],
      },
      {
        id: 'rscript-globals',
        title: 'Minimize global variables',
        workflow: 'r-script',
        category: 'structure',
        severity: 'important',
        description: 'Avoid relying on global state; use function parameters instead',
        tags: ['scope', 'best-practice'],
      },
      {
        id: 'rscript-errors',
        title: 'Handle errors gracefully with tryCatch',
        workflow: 'r-script',
        category: 'structure',
        severity: 'important',
        description: 'Use tryCatch for error handling in production scripts',
        tags: ['error-handling', 'robustness'],
      },
      {
        id: 'rscript-cleanup',
        title: 'Clean up connections and files',
        workflow: 'r-script',
        category: 'structure',
        severity: 'important',
        description: 'Close database connections and file handles at script end',
        tags: ['resource-management', 'cleanup'],
      },

      // ============== QUARTO ==============
      {
        id: 'quarto-labels',
        title: 'Use descriptive code chunk labels',
        workflow: 'quarto',
        category: 'structure',
        severity: 'recommended',
        description: 'Every code chunk needs a clear label (e.g., #| label: load-data)',
        tags: ['chunk', 'label'],
      },
      {
        id: 'quarto-options',
        title: 'Explicitly set chunk options',
        workflow: 'quarto',
        category: 'structure',
        severity: 'recommended',
        description: 'Use #| echo, #| eval, #| warning, #| message for clarity',
        tags: ['chunk', 'options'],
      },
      {
        id: 'quarto-yaml',
        title: 'Include comprehensive YAML frontmatter',
        workflow: 'quarto',
        category: 'documentation',
        severity: 'recommended',
        description: 'Include title, author, date, format, and other metadata',
        tags: ['yaml', 'metadata'],
      },
      {
        id: 'quarto-caching',
        title: 'Cache long-running computations',
        workflow: 'quarto',
        category: 'performance',
        severity: 'recommended',
        description: 'Use #| cache: true for expensive calculations',
        tags: ['cache', 'performance'],
      },
      {
        id: 'quarto-text',
        title: 'Include narrative text between code chunks',
        workflow: 'quarto',
        category: 'documentation',
        severity: 'important',
        description: 'Explain analysis steps, findings, and conclusions',
        tags: ['documentation', 'narrative'],
      },
      {
        id: 'quarto-figures',
        title: 'Include figure captions and labels',
        workflow: 'quarto',
        category: 'documentation',
        severity: 'recommended',
        description: 'Use #| fig-cap for meaningful figure descriptions',
        tags: ['figures', 'documentation'],
      },
      {
        id: 'quarto-tables',
        title: 'Format tables with appropriate options',
        workflow: 'quarto',
        category: 'structure',
        severity: 'recommended',
        description: 'Use knitr::kable() or gt for publication-quality tables',
        tags: ['tables', 'formatting'],
      },

      // ============== R MARKDOWN ==============
      {
        id: 'rmd-yaml',
        title: 'Include YAML header with output format',
        workflow: 'rmarkdown',
        category: 'documentation',
        severity: 'recommended',
        description: 'Specify output format (html_document, pdf_document, etc.)',
        tags: ['yaml', 'header'],
      },
      {
        id: 'rmd-chunks',
        title: 'Use labeled code chunks',
        workflow: 'rmarkdown',
        category: 'structure',
        severity: 'recommended',
        description: 'Name each chunk for navigation (e.g., ```{r load-data})',
        tags: ['chunk', 'label'],
      },
      {
        id: 'rmd-chunk-options',
        title: 'Set appropriate chunk options',
        workflow: 'rmarkdown',
        category: 'structure',
        severity: 'recommended',
        description: 'Use echo, eval, include, warning, message options appropriately',
        tags: ['chunk', 'options'],
      },
      {
        id: 'rmd-inline',
        title: 'Use inline code for dynamic values',
        workflow: 'rmarkdown',
        category: 'structure',
        severity: 'recommended',
        description: 'Embed R code in text using `r code` syntax',
        tags: ['inline', 'dynamic'],
      },

      // ============== SHINY ==============
      {
        id: 'shiny-separation',
        title: 'Separate UI and server logic',
        workflow: 'shiny',
        category: 'structure',
        severity: 'important',
        description: 'Use ui.R/server.R or modular app.R with clear sections',
        tags: ['structure', 'maintainability'],
      },
      {
        id: 'shiny-reactive',
        title: 'Use reactive() appropriately',
        workflow: 'shiny',
        category: 'performance',
        severity: 'important',
        description: 'Wrap computed values in reactive() to avoid recalculation',
        tags: ['reactive', 'performance'],
      },
      {
        id: 'shiny-observe',
        title: 'Use observe() for side effects',
        workflow: 'shiny',
        category: 'structure',
        severity: 'recommended',
        description: 'Use observe() or observeEvent() for actions without return value',
        tags: ['reactive', 'side-effects'],
      },
      {
        id: 'shiny-validation',
        title: 'Validate user inputs',
        workflow: 'shiny',
        category: 'structure',
        severity: 'important',
        description: 'Check input validity before processing',
        tags: ['validation', 'error-handling'],
      },
      {
        id: 'shiny-modules',
        title: 'Use modules for complex apps',
        workflow: 'shiny',
        category: 'structure',
        severity: 'recommended',
        description: 'Break large apps into reusable modules (callModule pattern)',
        tags: ['modules', 'reusability'],
      },
      {
        id: 'shiny-feedback',
        title: 'Provide user feedback and status',
        workflow: 'shiny',
        category: 'structure',
        severity: 'recommended',
        description: 'Show loading indicators, messages, and error notifications',
        tags: ['ux', 'feedback'],
      },
      {
        id: 'shiny-readme',
        title: 'Include README with usage instructions',
        workflow: 'shiny',
        category: 'documentation',
        severity: 'recommended',
        description: 'Document how to run the app and use its features',
        tags: ['documentation', 'readme'],
      },

      // ============== PACKAGES ==============
      {
        id: 'pkg-roxygen',
        title: 'Use roxygen2 for documentation',
        workflow: 'package',
        category: 'documentation',
        severity: 'important',
        description: 'Document functions with #\' @param, #\' @return, #\' @export',
        tags: ['roxygen', 'documentation'],
      },
      {
        id: 'pkg-description',
        title: 'Maintain accurate DESCRIPTION file',
        workflow: 'package',
        category: 'structure',
        severity: 'critical',
        description: 'Keep Package, Version, Title, Description, Authors, License current',
        tags: ['description', 'metadata'],
      },
      {
        id: 'pkg-tests',
        title: 'Include comprehensive tests',
        workflow: 'package',
        category: 'testing',
        severity: 'important',
        description: 'Use testthat package in tests/testthat/ directory',
        tags: ['testing', 'testthat'],
      },
      {
        id: 'pkg-namespace',
        title: 'Use NAMESPACE correctly',
        workflow: 'package',
        category: 'structure',
        severity: 'important',
        description: 'Export public functions and import dependencies properly',
        tags: ['namespace', 'exports'],
      },
      {
        id: 'pkg-vignettes',
        title: 'Include vignettes for complex features',
        workflow: 'package',
        category: 'documentation',
        severity: 'recommended',
        description: 'Add vignettes/ directory with usage examples',
        tags: ['vignettes', 'documentation'],
      },
      {
        id: 'pkg-readme',
        title: 'Create comprehensive README',
        workflow: 'package',
        category: 'documentation',
        severity: 'recommended',
        description: 'Include installation, basic usage, and example',
        tags: ['readme', 'documentation'],
      },
      {
        id: 'pkg-license',
        title: 'Include LICENSE file',
        workflow: 'package',
        category: 'structure',
        severity: 'critical',
        description: 'Specify license (MIT, GPL, Apache, etc.) in LICENSE file',
        tags: ['license', 'legal'],
      },
      {
        id: 'pkg-check',
        title: 'Pass devtools::check() without errors',
        workflow: 'package',
        category: 'testing',
        severity: 'important',
        description: 'Resolve all check() errors, warnings, and notes',
        tags: ['check', 'quality'],
      },
      {
        id: 'pkg-coverage',
        title: 'Aim for test coverage > 80%',
        workflow: 'package',
        category: 'testing',
        severity: 'recommended',
        description: 'Use covr package to measure and improve test coverage',
        tags: ['testing', 'coverage'],
      },

      // ============== RENV ==============
      {
        id: 'renv-init',
        title: 'Initialize renv for reproducibility',
        workflow: 'renv',
        category: 'dependency',
        severity: 'important',
        description: 'Run renv::init() at project start',
        tags: ['renv', 'initialization'],
      },
      {
        id: 'renv-lock',
        title: 'Track renv.lock in version control',
        workflow: 'renv',
        category: 'structure',
        severity: 'critical',
        description: 'Commit renv.lock to git for reproducible environments',
        tags: ['renv', 'vcs'],
      },
      {
        id: 'renv-snapshot',
        title: 'Use renv::snapshot() to update dependencies',
        workflow: 'renv',
        category: 'structure',
        severity: 'important',
        description: 'Always snapshot after installing new packages',
        tags: ['renv', 'workflow'],
      },
      {
        id: 'renv-restore',
        title: 'Use renv::restore() to initialize environment',
        workflow: 'renv',
        category: 'dependency',
        severity: 'important',
        description: 'New users run renv::restore() to install exact versions',
        tags: ['renv', 'setup'],
      },

      // ============== TARGETS ==============
      {
        id: 'targets-structure',
        title: 'Organize all targets in _targets.R',
        workflow: 'targets',
        category: 'structure',
        severity: 'recommended',
        description: 'Keep all target definitions in _targets.R',
        tags: ['targets', 'pipeline'],
      },
      {
        id: 'targets-naming',
        title: 'Use snake_case for target names',
        workflow: 'targets',
        category: 'naming',
        severity: 'recommended',
        description: 'Follow snake_case convention for all target names',
        tags: ['targets', 'naming'],
      },
      {
        id: 'targets-dependencies',
        title: 'Make dependencies explicit',
        workflow: 'targets',
        category: 'structure',
        severity: 'important',
        description: 'List all dependencies in target command',
        tags: ['targets', 'dependencies'],
      },
      {
        id: 'targets-branching',
        title: 'Use branching for parallel computation',
        workflow: 'targets',
        category: 'performance',
        severity: 'recommended',
        description: 'Apply targets::tar_map() for data parallelism',
        tags: ['targets', 'parallel'],
      },

      // ============== PLUMBER ==============
      {
        id: 'plumber-paths',
        title: 'Use clear, RESTful paths',
        workflow: 'plumber',
        category: 'structure',
        severity: 'recommended',
        description: 'Follow REST conventions (GET /api/data, POST /api/data)',
        tags: ['plumber', 'rest'],
      },
      {
        id: 'plumber-validation',
        title: 'Validate and sanitize all inputs',
        workflow: 'plumber',
        category: 'security',
        severity: 'critical',
        description: 'Never trust user input; validate all parameters',
        tags: ['plumber', 'security'],
      },
      {
        id: 'plumber-response',
        title: 'Return consistent JSON responses',
        workflow: 'plumber',
        category: 'structure',
        severity: 'recommended',
        description: 'Use consistent structure: {status, data, error}',
        tags: ['plumber', 'api'],
      },
      {
        id: 'plumber-status',
        title: 'Use appropriate HTTP status codes',
        workflow: 'plumber',
        category: 'structure',
        severity: 'important',
        description: 'Return 200 OK, 400 Bad Request, 500 Internal Error, etc.',
        tags: ['plumber', 'http'],
      },
      {
        id: 'plumber-error',
        title: 'Include meaningful error messages',
        workflow: 'plumber',
        category: 'structure',
        severity: 'important',
        description: 'Provide clear error descriptions for debugging',
        tags: ['plumber', 'errors'],
      },
      {
        id: 'plumber-docs',
        title: 'Document API endpoints with comments',
        workflow: 'plumber',
        category: 'documentation',
        severity: 'recommended',
        description: 'Add #* @param, #* @get comments for API documentation',
        tags: ['plumber', 'documentation'],
      },

      // ============== DATA ANALYSIS ==============
      {
        id: 'analysis-structure',
        title: 'Use standard directory structure',
        workflow: 'analysis',
        category: 'structure',
        severity: 'recommended',
        description: 'Create data/, R/, output/, scripts/ directories',
        tags: ['structure', 'organization'],
      },
      {
        id: 'analysis-readme',
        title: 'Include README explaining analysis',
        workflow: 'analysis',
        category: 'documentation',
        severity: 'recommended',
        description: 'Document goals, data sources, methodology, findings',
        tags: ['documentation', 'readme'],
      },
      {
        id: 'analysis-versioning',
        title: 'Version all data and outputs',
        workflow: 'analysis',
        category: 'structure',
        severity: 'important',
        description: 'Track data versions and regenerate outputs reproducibly',
        tags: ['versioning', 'reproducibility'],
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
