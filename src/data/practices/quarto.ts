import { Practice } from '../../types/practice.js';

export const quartoPractices: Practice[] = [
  {
    id: 'quarto-labels',
    title: 'Use descriptive code chunk labels',
    workflow: 'quarto',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Every code chunk needs a clear label (e.g., #| label: load-data)',
    details:
      'Labels make chunks easy to find in error messages, name the generated figure files, and are required for cross-references and caching. Put `#| label: name` as the first line of each chunk, using lowercase words separated by hyphens. The check is a simple line test: it flags any line opening a bare ```{r} fence without `label:` on that same line, so it also flags chunks labeled with `#| label:` on the following line.',
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
    description: 'Use #| echo, #| eval, #| warning, #| message for clarity',
    details:
      'Explicit options document what readers should see and keep warnings and package start-up messages out of the rendered output. Set defaults once in an `execute:` block in `_quarto.yml` or the document YAML, and override per chunk with `#|` lines. This is a heuristic: it flags projects that have R chunks, no chunk with a `#|` option line, and no `execute:` block in the .qmd YAML or `_quarto.yml`.',
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
      'The YAML front matter identifies the document and chooses the output format, so a reader or a build script knows what the file produces. Start every .qmd with a `---` block containing at least title, author, date and format. The check flags .qmd files whose first line does not start the front matter with `---`.',
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
    description: 'Use #| cache: true for expensive calculations',
    details:
      'Re-running every chunk on each render wastes time in documents with heavy computations. Use `#| cache: true` on slow chunks, or `freeze: auto` in `_quarto.yml` so unchanged documents are skipped when rendering a project. The check flags projects with at least three R chunks and no `cache:` or `freeze:` setting in YAML or chunk options.',
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
      'A document that is only code gives readers no context for why each step exists or what the output means. Add a sentence or two before and after each chunk to state the question, the method and the finding. This is a heuristic: it flags .qmd files with at least two R chunks and fewer than three non-empty prose lines outside the YAML, fenced blocks and headings.',
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
      'Captions tell readers what a plot shows, and a `fig-` prefixed label lets you cross-reference it with `@fig-name`. Add `#| label: fig-...` and `#| fig-cap:` to every chunk that draws a plot. This is a heuristic: it flags chunks calling `ggplot(`, `plot(`, `hist(`, `barplot(` or `boxplot(` with no `fig-cap` option, ignoring chunks with `eval: false` or `include: false`.',
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
      'Tables built with `knitr::kable()` or `gt` render cleanly in every format, and a `tbl-` label with `tbl-cap` makes them numbered and referenceable. Set `#| label: tbl-...` and `#| tbl-cap:` on the chunk. This is a heuristic: it flags chunks calling `kable(`, `gt(` or kableExtra functions that have neither a `tbl-cap` option nor a `caption =` argument.',
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
