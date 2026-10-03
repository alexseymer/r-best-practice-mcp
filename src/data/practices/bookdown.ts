import { Practice } from '../../types/practice.js';

export const bookdownPractices: Practice[] = [
  {
    id: 'bookdown-config',
    title: 'Create _bookdown.yaml configuration',
    workflow: 'bookdown',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Define book structure, output directory, and options in _bookdown.yaml',
    details:
      'The `_bookdown.yml` file controls the book title, chapter order, output directory and label prefixes, so `bookdown::render_book()` behaves the same on every machine. Create it in the project root and set at least `book_filename` and `output_dir`. The check looks for `_bookdown.yml` or `_bookdown.yaml` in the project root.',
    badExample: `my-book/
  index.Rmd
  01-intro.Rmd
  02-methods.Rmd`,
    goodExample: `# _bookdown.yml
book_filename: "my-book"
output_dir: "_book"
language:
  ui:
    chapter_name: "Chapter "
rmd_files:
  - index.Rmd
  - 01-intro.Rmd
  - 02-methods.Rmd`,
    tags: ['bookdown', 'configuration'],
    references: [
      'https://bookdown.org/yihui/bookdown/configuration.html',
      'https://bookdown.org/yihui/bookdown/usage.html',
    ],
  },
  {
    id: 'bookdown-index',
    title: 'Use index.Rmd as introduction',
    workflow: 'bookdown',
    category: 'structure',
    severity: 'critical',
    enforcement: 'automated',
    description: 'Place introduction content in index.Rmd (first chapter)',
    details:
      'bookdown treats `index.Rmd` as the first file of the book and reads the book-wide YAML metadata from it; it also becomes the home page of the HTML output. Keep the title, author and output settings in its YAML header and write the preface or introduction below. The check looks for `index.Rmd` in the project root.',
    badExample: `my-book/
  _bookdown.yml
  01-intro.Rmd
  02-methods.Rmd`,
    goodExample: `---
title: "My Book"
author: "A. Analyst"
site: bookdown::bookdown_site
---

# Preface {-}

This book explains how we analyse flight delays.`,
    tags: ['bookdown', 'structure'],
    references: [
      'https://bookdown.org/yihui/bookdown/usage.html',
      'https://bookdown.org/yihui/bookdown/build-the-book.html',
    ],
  },
  {
    id: 'bookdown-chapter-naming',
    title: 'Use clear chapter naming convention',
    workflow: 'bookdown',
    category: 'naming',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Name chapters as 01-title.Rmd, 02-title.Rmd for proper ordering',
    details:
      'bookdown merges .Rmd files in alphabetical order, so a numeric prefix is the simplest way to control chapter order. Use two digits, a lowercase title and hyphens, for example `03-results.Rmd`. The check inspects .Rmd files in the project root, ignoring `index.Rmd`, `README.Rmd` and files starting with an underscore, and flags names not matching `NN-lowercase-title.Rmd`.',
    badExample: `my-book/
  index.Rmd
  Intro.Rmd
  methods_v2.Rmd
  Results Final.Rmd`,
    goodExample: `my-book/
  index.Rmd
  01-intro.Rmd
  02-methods.Rmd
  03-results.Rmd`,
    tags: ['naming', 'organization'],
    references: [
      'https://bookdown.org/yihui/bookdown/usage.html',
      'https://bookdown.org/yihui/bookdown/configuration.html',
    ],
  },
  {
    id: 'bookdown-output-formats',
    title: 'Configure multiple output formats',
    workflow: 'bookdown',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Define HTML, PDF, and EPUB outputs in _output.yml',
    details:
      'Readers want the same book as a web page, a PDF and an e-book, and keeping each format in `_output.yml` avoids cluttering index.Rmd. List `bookdown::gitbook`, `bookdown::pdf_book` and optionally `bookdown::epub_book` there. The check passes when `_output.yml` exists; otherwise it counts distinct `bookdown::` formats in the index.Rmd YAML and flags fewer than two.',
    badExample: `---
title: "My Book"
site: bookdown::bookdown_site
output: bookdown::gitbook
---`,
    goodExample: `# _output.yml
bookdown::gitbook:
  split_by: chapter
  config:
    toc:
      collapse: section
bookdown::pdf_book:
  latex_engine: xelatex
  keep_tex: true
bookdown::epub_book: default`,
    tags: ['bookdown', 'output'],
    references: [
      'https://bookdown.org/yihui/bookdown/output-formats.html',
      'https://bookdown.org/yihui/bookdown/build-the-book.html',
    ],
  },
  {
    id: 'bookdown-cross-references',
    title: 'Use cross-references for chapters and figures',
    workflow: 'bookdown',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Use (\\#ref:label) for cross-referencing sections and figures',
    details:
      'Cross-references stay correct when figures or chapters are renumbered, unlike hand-typed numbers. Label a figure through its chunk label, a table the same way, a section with `{#label}`, and cite them with `\\@ref(fig:label)`, `\\@ref(tab:label)` or `\\@ref(label)`. This is a heuristic: it flags books where some chunk has `fig.cap`, `plot(`, `ggplot(` or `kable(` but no `\\@ref(` appears in any .Rmd.',
    badExample: `\`\`\`{r cars-plot, fig.cap="Speed and stopping distance"}
plot(cars)
\`\`\`

As Figure 3 shows, stopping distance grows with speed.`,
    goodExample: `\`\`\`{r cars-plot, fig.cap="Speed and stopping distance"}
plot(cars)
\`\`\`

As Figure \\@ref(fig:cars-plot) shows, stopping distance
grows with speed. See also Chapter \\@ref(methods).

# Methods {#methods}`,
    tags: ['bookdown', 'documentation'],
    references: [
      'https://bookdown.org/yihui/bookdown/cross-references.html',
      'https://bookdown.org/yihui/bookdown/figures.html',
    ],
  },
  {
    id: 'bookdown-readme',
    title: 'Document how to build the book',
    workflow: 'bookdown',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Include build instructions and dependencies in README.md',
    details:
      'Contributors need to know which packages and system tools (such as LaTeX) are required and which command builds the book. Add a README.md that lists dependencies and the build command, for example `bookdown::render_book("index.Rmd")`. The check looks for `README.md` in the project root.',
    badExample: `my-book/
  index.Rmd
  _bookdown.yml
  01-intro.Rmd`,
    goodExample: `# My Book

## Build

Install dependencies:

    install.packages(c("bookdown", "tinytex"))

Render all formats:

    Rscript -e 'bookdown::render_book("index.Rmd", "all")'`,
    tags: ['documentation', 'readme'],
    references: [
      'https://bookdown.org/yihui/bookdown/build-the-book.html',
      'https://bookdown.org/yihui/bookdown/',
    ],
  },
];
