import { Practice } from '../../types/practice.js';

export const analysisPractices: Practice[] = [
  {
    id: 'analysis-structure',
    title: 'Use standard directory structure',
    workflow: 'analysis',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Create data/, R/, output/, scripts/ directories',
    tags: ['structure', 'organization'],
  },
  {
    id: 'analysis-readme',
    title: 'Include README explaining analysis',
    workflow: 'analysis',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Document goals, data sources, methodology, findings',
    tags: ['documentation', 'readme'],
  },
  {
    id: 'analysis-versioning',
    title: 'Version all data and outputs',
    workflow: 'analysis',
    category: 'structure',
    severity: 'important',
    enforcement: 'guidance',
    description: 'Track data versions and regenerate outputs reproducibly',
    tags: ['versioning', 'reproducibility'],
  },
];
