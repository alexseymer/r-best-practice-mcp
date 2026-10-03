import { Practice } from '../../types/practice.js';

export const analysisPractices: Practice[] = [
  {
    id: 'analysis-structure',
    title: 'Use standard directory structure',
    workflow: 'analysis',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description:
      'Create data/, R/ and output/ directories (scripts/ is a common extra, not checked)',
    details:
      'A predictable layout separates raw data, reusable code and generated results, so collaborators (and you in six months) know where everything lives. The check reports one finding for each of data/, R/ and output/ that is missing from the project root (directory names are matched exactly, including the capital R); it does not look inside them and does not require scripts/. Keep raw data read-only in data/, put functions in R/, and write every generated file to output/.',
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
      'A README is the first thing a reader opens, so it should state the question, where the data came from, how to rerun the analysis and what was found. The check (part of the analysis project validation) passes when the project root contains a file named README.md, README.Rmd or README; it does not read the content, so the advice about what to include is not verified. Names are matched exactly, so readme.md does not count on case-sensitive file systems. Include the R version or a pointer to the renv lockfile so results can be reproduced.',
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
    title: 'Put the analysis under version control',
    workflow: 'analysis',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Track code, raw-data provenance and renv.lock; ignore large or generated outputs',
    details:
      'Version control records how code changed, lets you undo mistakes and makes it clear which commit produced a given result. The check looks for a .git entry (directory or file) in the project directory or any parent directory and reports when none is found; it does not verify what is committed or ignored. Use usethis::use_git(), then commit code, renv.lock and either small raw data or a note recording where each raw file came from (source, date, checksum). Ignore large or generated outputs, which scripts can regenerate, and keep large data under Git LFS or DVC.',
    badExample: `my-analysis/
  analysis.R
  analysis_v2.R
  analysis_v2_final.R
  results_final_FINAL.csv
  # no .git directory anywhere above this folder`,
    goodExample: `# in the R console, from the project root
usethis::use_git()

# then, in a shell
git add R/ scripts/ README.md renv.lock data/README.md
git commit -m "Add cleaning script and data provenance notes"

# .gitignore: regenerate large or generated files instead of committing them
output/
data/raw/*.parquet`,
    tags: ['versioning', 'reproducibility'],
    references: ['https://happygitwithr.com/', 'https://usethis.r-lib.org/reference/use_git.html'],
  },
];
