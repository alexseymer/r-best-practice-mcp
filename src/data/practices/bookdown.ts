import { Practice } from '../../types/practice.js';

export const bookdownPractices: Practice[] = [
  {
    id: 'bookdown-config',
    title: 'Create a _bookdown.yml configuration file',
    workflow: 'bookdown',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Define the book file name, output directory and chapter list in _bookdown.yml',
    details:
      '`_bookdown.yml` is the file bookdown reads for the output file name (`book_filename`), output directory (`output_dir`), explicit chapter list (`rmd_files`), UI strings and label prefixes, so `bookdown::render_book()` behaves the same on every machine. Create it in the project root. The check only tests that `_bookdown.yml` (or the alternative spelling `_bookdown.yaml`) exists in the project root; it does not read the file or verify any key.',
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
      'bookdown treats `index.Rmd` as the first file of the book and reads the book-wide YAML metadata from it; it also becomes the home page of the HTML output. Keep the title, author and output settings in its YAML header and write the preface or introduction below. The check only tests that a file named exactly `index.Rmd` exists in the project root; the content of its YAML header is not verified.',
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
      'By default bookdown merges the .Rmd files of the project root in alphabetical order (index.Rmd first), so a numeric prefix is the simplest way to control chapter order; an explicit `rmd_files:` list in `_bookdown.yml` overrides that order, in which case the prefix is only a naming convention. Use two digits, a lowercase title and hyphens, for example `03-results.Rmd`. The check inspects only the .Rmd files directly in the project root, exempts `index.Rmd`, `README.Rmd` and files starting with an underscore (which bookdown ignores), and flags every other name that does not match `NN-lowercase-title.Rmd` (two digits, then lowercase letters, digits and hyphens). It does not read `rmd_files`.',
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
    description: 'Define HTML, PDF and optionally EPUB outputs in _output.yml',
    details:
      'Readers want the same book as a web page, a PDF and an e-book, and keeping each format in `_output.yml` avoids cluttering index.Rmd. List `bookdown::gitbook`, `bookdown::pdf_book` and optionally `bookdown::epub_book` there. This is a heuristic: the check passes whenever `_output.yml` or `_output.yaml` exists in the project root, whatever it contains. Without one, it counts the distinct `bookdown::name` strings in the YAML header of index.Rmd (so `site: bookdown::bookdown_site` counts as one of them) and flags fewer than two. It stays silent when index.Rmd is missing.',
    badExample: `---
title: "My Book"
output: bookdown::gitbook   # HTML only, and no _output.yml
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
    description:
      'Use \\@ref(fig:label), \\@ref(tab:label) and \\@ref(section-id) instead of hand-typed numbers',
    details:
      'Cross-references stay correct when figures, tables or chapters are renumbered, unlike hand-typed numbers. A figure needs a chunk label and a `fig.cap`, and is cited with `\\@ref(fig:label)`; a table needs a chunk label and a caption (`knitr::kable(caption = ...)` or the `tab.cap` chunk option) before `\\@ref(tab:label)` resolves; a section is given an id with `{#section-id}` and cited with `\\@ref(section-id)`. This is a heuristic: it scans .Rmd files in the project (recursively) and flags the book when some chunk has `fig.cap`/`fig-cap` or calls `plot(`, `ggplot(` or `kable(`, yet no .Rmd file contains the literal text `\\@ref(` anywhere. A single `\\@ref(` in any file satisfies it, and its target is not validated.',
    badExample: `\`\`\`{r cars-plot, fig.cap="Speed and stopping distance"}
plot(cars)
\`\`\`

As Figure 3 shows, stopping distance grows with speed.`,
    goodExample: `\`\`\`{r cars-plot, fig.cap="Speed and stopping distance"}
plot(cars)
\`\`\`

As Figure \\@ref(fig:cars-plot) shows, stopping distance
grows with speed. See also Chapter \\@ref(methods).

\`\`\`{r cars-table}
knitr::kable(head(cars), caption = "First rows of the cars data")
\`\`\`

Table \\@ref(tab:cars-table) lists the first observations.

# Methods {#methods}`,
    tags: ['bookdown', 'documentation'],
    references: [
      'https://bookdown.org/yihui/bookdown/cross-references.html',
      'https://bookdown.org/yihui/bookdown/figures.html',
      'https://bookdown.org/yihui/bookdown/tables.html',
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
      'Contributors need to know which packages and system tools (such as LaTeX) are required and which command builds the book. Add a README.md that lists dependencies and the build command, for example `bookdown::render_book("index.Rmd")`. The check only tests that a file named exactly `README.md` exists in the project root (`README.Rmd` does not satisfy it) and does not read its content.',
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
