import { Practice } from '../../types/practice.js';

export const targetsPractices: Practice[] = [
  {
    id: 'targets-structure',
    title: 'Organize all targets in _targets.R',
    workflow: 'targets',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Keep all target definitions in _targets.R',
    tags: ['targets', 'pipeline'],
  },
  {
    id: 'targets-naming',
    title: 'Use snake_case for target names',
    workflow: 'targets',
    category: 'naming',
    severity: 'recommended',
    enforcement: 'guidance',
    description: 'Follow snake_case convention for all target names',
    tags: ['targets', 'naming'],
  },
  {
    id: 'targets-dependencies',
    title: 'Make dependencies explicit',
    workflow: 'targets',
    category: 'structure',
    severity: 'important',
    enforcement: 'guidance',
    description: 'List all dependencies in target command',
    tags: ['targets', 'dependencies'],
  },
  {
    id: 'targets-branching',
    title: 'Use branching for parallel computation',
    workflow: 'targets',
    category: 'performance',
    severity: 'recommended',
    enforcement: 'guidance',
    description: 'Apply targets::tar_map() for data parallelism',
    tags: ['targets', 'parallel'],
  },
];
