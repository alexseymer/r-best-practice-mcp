import { Practice } from '../../types/practice.js';

export const rmarkdownPractices: Practice[] = [
  {
    id: 'rmd-yaml',
    title: 'Include YAML header with output format',
    workflow: 'rmarkdown',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Specify output format (html_document, pdf_document, etc.)',
    tags: ['yaml', 'header'],
  },
  {
    id: 'rmd-chunks',
    title: 'Use labeled code chunks',
    workflow: 'rmarkdown',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'guidance',
    description: 'Name each chunk for navigation (e.g., ```{r load-data})',
    tags: ['chunk', 'label'],
  },
  {
    id: 'rmd-chunk-options',
    title: 'Set appropriate chunk options',
    workflow: 'rmarkdown',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'guidance',
    description: 'Use echo, eval, include, warning, message options appropriately',
    tags: ['chunk', 'options'],
  },
  {
    id: 'rmd-inline',
    title: 'Use inline code for dynamic values',
    workflow: 'rmarkdown',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'guidance',
    description: 'Embed R code in text using `r code` syntax',
    tags: ['inline', 'dynamic'],
  },
];
