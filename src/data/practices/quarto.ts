import { Practice } from '../../types/practice.js';

export const quartoPractices: Practice[] = [
  {
    id: 'quarto-labels',
    title: 'Use descriptive code chunk labels',
    workflow: 'quarto',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Give every R code chunk a short descriptive label (e.g., #| label: load-data)',
    details:
      'Labels let you cross-reference figures and tables (`@fig-...` and `@tbl-...` need chunks labelled with those prefixes), make render logs and error messages point at a named chunk, and give figure files and cache entries stable names instead of auto-generated `unnamed-chunk-N` names that shift when chunks are reordered. Labels are not required for caching to work, because knitr labels unlabelled chunks automatically. Put `#| label: name` as the first line of each chunk, using lowercase words separated by hyphens. The check scans the .qmd files in the project root (subdirectories are not scanned) and reports the first unlabelled R chunk of each file; python or other engines are ignored. A label counts when given as a `#| label:` option line directly after the fence, as a bare label in the header (```{r mylabel}```) or as `label=` in the header.',
    badExample: `\`\`\`{r}
library(dplyr)
flights <- read.csv("flights.csv")
\`\`\`

\`\`\`{r}
summary(flights)
\`\`\``,
    goodExample: `\`\`\`{r}
#| label: load-data
library(dplyr)
flights <- read.csv("flights.csv")
\`\`\`

\`\`\`{r}
#| label: flights-summary
summary(flights)
\`\`\``,
    tags: ['chunk', 'label'],
    references: [
      'https://quarto.org/docs/computations/r.html',
      'https://quarto.org/docs/computations/execution-options.html',
    ],
  },
  {
    id: 'quarto-options',
    title: 'Explicitly set chunk options',
    workflow: 'quarto',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description:
      'Set options such as echo, warning and message explicitly, per chunk with #| lines or project-wide with execute:',
    details:
      'Explicit options document what readers should see and keep warnings and package start-up messages out of the rendered output. Set defaults once in an `execute:` block in `_quarto.yml` or the document YAML, and override per chunk with `#|` lines. This is a heuristic that does not verify which options are set. It scans .qmd files in the project (recursively) and passes as soon as any one R chunk has any `#|` option line (even just `#| label:`), any chunk header sets echo, eval, include, warning, message or a fig.* option, any chunk calls `knitr::opts_chunk$set(`, or an `execute:` key exists in a .qmd YAML header or in `_quarto.yml`/`_quarto.yaml` in the project root. It reports only when none of these is found.',
    badExample: `---
title: "Flight delays"
format: html
---

\`\`\`{r}
library(dplyr)
flights |> count(carrier)
\`\`\``,
    goodExample: `---
title: "Flight delays"
format: html
execute:
  warning: false
  message: false
---

\`\`\`{r}
#| label: carrier-counts
#| echo: true
library(dplyr)
flights |> count(carrier)
\`\`\``,
    tags: ['chunk', 'options'],
    references: [
      'https://quarto.org/docs/computations/execution-options.html',
      'https://quarto.org/docs/projects/code-execution.html',
    ],
  },
  {
    id: 'quarto-yaml',
    title: 'Include comprehensive YAML frontmatter',
    workflow: 'quarto',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Include title, author, date, format, and other metadata',
    details:
      'The YAML front matter identifies the document and chooses the output format, so a reader or a build script knows what the file produces. Start every .qmd with a `---` block containing at least title, author, date and format. The check only looks at the first line of each .qmd file in the project root (and of a single validated file) and flags files that do not begin with `---`; it does not verify that title, author, date or format are present.',
    badExample: `\`\`\`{r}
#| label: setup
library(ggplot2)
\`\`\`

## Results

Delays increased in 2023.`,
    goodExample: `---
title: "Flight delay analysis"
author: "A. Analyst"
date: today
format:
  html:
    toc: true
    code-fold: true
---

## Results

Delays increased in 2023.`,
    tags: ['yaml', 'metadata'],
    references: [
      'https://quarto.org/docs/output-formats/html-basics.html',
      'https://quarto.org/docs/reference/formats/html.html',
    ],
  },
  {
    id: 'quarto-caching',
    title: 'Cache long-running computations',
    workflow: 'quarto',
    category: 'performance',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Use #| cache: true on expensive chunks or freeze: auto for project renders',
    details:
      'Re-running every chunk on each render wastes time in documents with heavy computations. Use `#| cache: true` on slow chunks, or `freeze: auto` in `_quarto.yml` so unchanged documents are skipped when rendering a project. Note that `freeze` only takes effect when rendering a Quarto project, and `cache` needs the knitr engine. This is a coarse heuristic: it counts R chunks over all .qmd files in the project (recursively) and, when there are at least three, passes if a `cache` or `freeze` setting appears anywhere (a .qmd YAML header, `_quarto.yml`/`_quarto.yaml` in the project root, a chunk option line or header option, or a `cache =` argument such as in `opts_chunk$set()`). It does not check that the cached chunks are the slow ones.',
    badExample: `\`\`\`{r}
#| label: fit-model
model <- lm(delay ~ ., data = big_flights)
\`\`\`

\`\`\`{r}
#| label: model-summary
summary(model)
\`\`\`

\`\`\`{r}
#| label: residuals
plot(residuals(model))
\`\`\``,
    goodExample: `# _quarto.yml
project:
  type: website
execute:
  freeze: auto

# in the .qmd
\`\`\`{r}
#| label: fit-model
#| cache: true
model <- lm(delay ~ ., data = big_flights)
\`\`\``,
    tags: ['cache', 'performance'],
    references: [
      'https://quarto.org/docs/projects/code-execution.html',
      'https://quarto.org/docs/computations/caching.html',
    ],
  },
  {
    id: 'quarto-text',
    title: 'Include narrative text between code chunks',
    workflow: 'quarto',
    category: 'documentation',
    severity: 'important',
    enforcement: 'automated',
    description: 'Explain analysis steps, findings, and conclusions',
    details:
      'A document that is only code gives readers no context for why each step exists or what the output means. Add a sentence or two before and after each chunk to state the question, the method and the finding. This is a heuristic that only counts lines: it scans .qmd files in the project (recursively) and flags a file with at least two R chunks and fewer than three non-empty lines outside the YAML header, fenced code blocks, `:::` div fences and lines starting with `#` (headings). Any such line counts as narrative, including list items and table rows, and the quality of the prose is not assessed.',
    badExample: `---
title: "Delays"
---

\`\`\`{r}
#| label: load
d <- read.csv("flights.csv")
\`\`\`

\`\`\`{r}
#| label: model
fit <- lm(delay ~ distance, d)
\`\`\``,
    goodExample: `---
title: "Delays"
---

## Data

We use the 2023 flight records, one row per departure.

\`\`\`{r}
#| label: load
d <- read.csv("flights.csv")
\`\`\`

## Model

Longer routes might delay more, so we regress delay on distance.
The slope below is small but clearly positive.

\`\`\`{r}
#| label: model
fit <- lm(delay ~ distance, d)
\`\`\``,
    tags: ['documentation', 'narrative'],
    references: [
      'https://quarto.org/docs/computations/r.html',
      'https://quarto.org/docs/authoring/markdown-basics.html',
    ],
  },
  {
    id: 'quarto-figures',
    title: 'Include figure captions and labels',
    workflow: 'quarto',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Use #| fig-cap for meaningful figure descriptions',
    details:
      'Captions tell readers what a plot shows, and a `fig-` prefixed label lets you cross-reference it with `@fig-name`. Add `#| label: fig-...` and `#| fig-cap:` to every chunk that draws a plot. This is a heuristic: it scans .qmd files in the project (recursively) and flags R chunks whose code (comments and strings ignored) calls `ggplot(`, `plot(`, `hist(`, `barplot(` or `boxplot(` and that set no caption, meaning neither a `#| fig-cap:` option line nor `fig-cap=`/`fig.cap=` in the chunk header. Chunks with `eval` or `include` set to false (`#| eval: false` or `eval=FALSE`) are skipped, other plotting functions are not recognised, and the `fig-` label prefix is not checked. One finding lists the first few chunks.',
    badExample: `\`\`\`{r}
#| label: delays-plot
ggplot(flights, aes(distance, delay)) +
  geom_point()
\`\`\``,
    goodExample: `\`\`\`{r}
#| label: fig-delays
#| fig-cap: "Departure delay by route distance."
ggplot(flights, aes(distance, delay)) +
  geom_point()
\`\`\`

As @fig-delays shows, the trend is weak.`,
    tags: ['figures', 'documentation'],
    references: [
      'https://quarto.org/docs/authoring/figures.html',
      'https://quarto.org/docs/authoring/cross-references.html',
    ],
  },
  {
    id: 'quarto-tables',
    title: 'Format tables with appropriate options',
    workflow: 'quarto',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Use knitr::kable() or gt for publication-quality tables',
    details:
      'Tables built with `knitr::kable()` or `gt` render cleanly in every format, and a `tbl-` label with `tbl-cap` makes them numbered and referenceable. Set `#| label: tbl-...` and `#| tbl-cap:` on the chunk. This is a heuristic: it scans .qmd files in the project (recursively) and flags R chunks whose code (comments and strings ignored) calls `kable(`, `kbl(`, `gt(` or a kableExtra function such as `kable_styling(`, and that have no `#| tbl-cap:` option line, no `tbl-cap=`/`tbl.cap=` header option and no `caption =` argument in the chunk code outside `labs()`, `ggtitle()`, `xlab()` and `ylab()` calls (plot captions do not count, a `caption =` in any other call such as `kable()` does). Chunks with `eval` or `include` set to false are skipped, other table functions are not recognised, and the `tbl-` label prefix is not checked.',
    badExample: `\`\`\`{r}
#| label: carrier-table
knitr::kable(head(carriers))
\`\`\``,
    goodExample: `\`\`\`{r}
#| label: tbl-carriers
#| tbl-cap: "Carriers with the most departures."
knitr::kable(head(carriers), digits = 1)
\`\`\`

See @tbl-carriers for the ranking.`,
    tags: ['tables', 'formatting'],
    references: [
      'https://quarto.org/docs/authoring/tables.html',
      'https://quarto.org/docs/authoring/cross-references.html',
    ],
  },
];
