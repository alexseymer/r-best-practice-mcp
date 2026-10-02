import { Practice } from '../../types/practice.js';

export const renvPractices: Practice[] = [
  {
    id: 'renv-init',
    title: 'Initialize renv for reproducibility',
    workflow: 'renv',
    category: 'dependency',
    severity: 'important',
    enforcement: 'guidance',
    description: 'Run renv::init() at project start',
    tags: ['renv', 'initialization'],
  },
  {
    id: 'renv-lock',
    title: 'Track renv.lock in version control',
    workflow: 'renv',
    category: 'structure',
    severity: 'critical',
    enforcement: 'automated',
    description: 'Commit renv.lock to git for reproducible environments',
    tags: ['renv', 'vcs'],
  },
  {
    id: 'renv-snapshot',
    title: 'Use renv::snapshot() to update dependencies',
    workflow: 'renv',
    category: 'structure',
    severity: 'important',
    enforcement: 'guidance',
    description: 'Always snapshot after installing new packages',
    tags: ['renv', 'workflow'],
  },
  {
    id: 'renv-restore',
    title: 'Use renv::restore() to initialize environment',
    workflow: 'renv',
    category: 'dependency',
    severity: 'important',
    enforcement: 'guidance',
    description: 'New users run renv::restore() to install exact versions',
    tags: ['renv', 'setup'],
  },
];
