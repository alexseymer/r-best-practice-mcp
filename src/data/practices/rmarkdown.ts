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
    details:
      'The YAML header names the document and selects the output format, so `rmarkdown::render()` knows what to build without extra arguments. Begin every .Rmd with a `---` block that has title, author, date and an `output:` entry. The check only looks at the first line of each .Rmd file in the project root (and of a single validated file) and flags files that do not begin with `---`; it does not verify that title, author, date or `output:` are present.',
    badExample: `# Flight delays

\`\`\`{r setup}
library(dplyr)
\`\`\``,
    goodExample: `---
title: "Flight delays"
author: "A. Analyst"
date: "2026-01-15"
output:
  html_document:
    toc: true
---

\`\`\`{r setup}
library(dplyr)
\`\`\``,
    tags: ['yaml', 'header'],
    references: [
      'https://rmarkdown.rstudio.com/lesson-6.html',
      'https://bookdown.org/yihui/rmarkdown/html-document.html',
    ],
  },
  {
    id: 'rmd-chunks',
    title: 'Use labeled code chunks',
    workflow: 'rmarkdown',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Name each chunk for navigation (e.g., ```{r load-data})',
    details:
      'Chunk labels appear in the RStudio outline, in knitr progress output and in error messages, and they name the generated figure files. Give every chunk a unique short label right after `r`, before any options. The check scans .Rmd files in the project (recursively, skipping directories such as renv, docs, public and _book) and flags R chunk headers such as ```{r} or ```{r, echo=FALSE} where the first item is missing or is an option containing `=`; a `label=` option or a `#| label:` line also counts as a label. Only R chunks are checked and one finding lists the first few unlabelled chunks.',
    badExample: `\`\`\`{r}
flights <- read.csv("flights.csv")
\`\`\`

\`\`\`{r, echo=FALSE}
hist(flights$delay)
\`\`\``,
    goodExample: `\`\`\`{r load-data}
flights <- read.csv("flights.csv")
\`\`\`

\`\`\`{r delay-histogram, echo=FALSE}
hist(flights$delay)
\`\`\``,
    tags: ['chunk', 'label'],
    references: [
      'https://rmarkdown.rstudio.com/lesson-3.html',
      'https://bookdown.org/yihui/rmarkdown-cookbook/chunk-options.html',
    ],
  },
  {
    id: 'rmd-chunk-options',
    title: 'Set appropriate chunk options',
    workflow: 'rmarkdown',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Use echo, eval, include, warning, message options appropriately',
    details:
      'Default knitr options print all code, warnings and messages, which clutters reports. Set shared defaults once in a setup chunk with `knitr::opts_chunk$set()` and override them on individual chunks. This is a heuristic that does not verify which options are set: it scans .Rmd files in the project (recursively) and passes as soon as any one R chunk has a header option or `#|` option line named echo, eval, include, warning, message or fig.*, or calls `opts_chunk$set(`, or when `opts_chunk$set(` appears in any .R or .r file in the project (for example a sourced setup script). It reports only when none of these is found.',
    badExample: `\`\`\`{r setup}
library(dplyr)
\`\`\`

\`\`\`{r load-data}
flights <- read.csv("flights.csv")
\`\`\``,
    goodExample: `\`\`\`{r setup, include=FALSE}
knitr::opts_chunk$set(
  echo = FALSE,
  warning = FALSE,
  message = FALSE,
  fig.width = 6
)
library(dplyr)
\`\`\`

\`\`\`{r load-data}
flights <- read.csv("flights.csv")
\`\`\``,
    tags: ['chunk', 'options'],
    references: [
      'https://bookdown.org/yihui/rmarkdown-cookbook/chunk-options.html',
      'https://rmarkdown.rstudio.com/lesson-3.html',
    ],
  },
  {
    id: 'rmd-inline',
    title: 'Use inline code for dynamic values',
    workflow: 'rmarkdown',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'guidance',
    description: 'Embed R code in text using `r code` syntax',
    details:
      'Numbers typed by hand into prose go stale when the data changes. Compute the value in a chunk, then insert it with inline code of the form `r expression` so the text updates on every knit. Round or format values with `round()` or `format()` inside the expression. This practice is guidance only and is not checked automatically.',
    badExample: `The data contain 1,204 flights with a
mean delay of 13.2 minutes.`,
    goodExample: `\`\`\`{r delay-stats, include=FALSE}
n_flights <- nrow(flights)
mean_delay <- mean(flights$delay, na.rm = TRUE)
\`\`\`

The data contain \`r n_flights\` flights with a
mean delay of \`r round(mean_delay, 1)\` minutes.`,
    tags: ['inline', 'dynamic'],
    references: [
      'https://rmarkdown.rstudio.com/lesson-4.html',
      'https://bookdown.org/yihui/rmarkdown-cookbook/r-code.html',
    ],
  },
];
