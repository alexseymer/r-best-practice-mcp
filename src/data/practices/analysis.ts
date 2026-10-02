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
    details:
      'A predictable layout separates raw data, reusable code and generated results, so collaborators (and you in six months) know where everything lives. The check reports a finding for each of data/, R/ and output/ that is missing from the project root. Keep raw data read-only in data/, put functions in R/, and write every generated file to output/.',
    badExample: `my-analysis/
  analysis.R
  data.csv
  plot1.png
  results_final_v2.csv`,
    goodExample: `my-analysis/
  README.md
  data/
    raw/
  R/
    clean_data.R
  scripts/
    01_run_analysis.R
  output/
    figures/`,
    tags: ['structure', 'organization'],
    references: ['https://rstats.wtf/projects', 'https://r4ds.hadley.nz/workflow-scripts.html'],
  },
  {
    id: 'analysis-readme',
    title: 'Include README explaining analysis',
    workflow: 'analysis',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Document goals, data sources, methodology, findings',
    details:
      'A README is the first thing a reader opens, so it should state the question, where the data came from, how to rerun the analysis and what was found. The check looks for a README.md in the project root. Include the R version or a pointer to the renv lockfile so results can be reproduced.',
    badExample: `my-analysis/
  analysis.R
  data/
  # no README: nobody knows what question is answered
  # or which script to run first`,
    goodExample: `# Customer churn analysis

## Question
Which factors predict churn within 90 days?

## Data
data/raw/customers.csv (CRM export, 2024-03-01)

## How to run
1. renv::restore()
2. source("scripts/01_run_analysis.R")

## Findings
See output/report.html.`,
    tags: ['documentation', 'readme'],
    references: ['https://rstats.wtf/projects', 'https://r4ds.hadley.nz/workflow-scripts.html'],
  },
  {
    id: 'analysis-versioning',
    title: 'Version all data and outputs',
    workflow: 'analysis',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Track data versions and regenerate outputs reproducibly',
    details:
      'Version control records how code and results changed, lets you undo mistakes and makes it clear which commit produced a given output. The check looks for a .git entry in the project directory or any parent directory and reports when none is found; it does not verify what is committed. Use usethis::use_git(), commit small data files and code, and keep large data under Git LFS or DVC with outputs regenerated from scripts.',
    badExample: `my-analysis/
  analysis.R
  analysis_v2.R
  analysis_v2_final.R
  results_final_FINAL.csv
  # no .git directory anywhere above this folder`,
    goodExample: `# in the R console, from the project root
usethis::use_git()

# then, in a shell
git add R/ scripts/ data/raw/ README.md
git commit -m "Add cleaning script and raw data"

# .gitignore: regenerate large outputs instead of committing them
output/*.rds`,
    tags: ['versioning', 'reproducibility'],
    references: ['https://happygitwithr.com/', 'https://usethis.r-lib.org/reference/use_git.html'],
  },
];
