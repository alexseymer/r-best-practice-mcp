import { TemplateFile, TemplateGeneratorOptions } from '../../types/template.js';

export function generateQuarto(options: TemplateGeneratorOptions): {
  files: TemplateFile[];
  directories: string[];
} {
  const projectName = options.projectName || 'analysis';

  return {
    files: [
      {
        path: 'analysis.qmd',
        content: `---
title: "${projectName}"
author: "${options.authorName || 'Author Name'}"
date: today
format: html
execute:
  echo: true
  warning: false
  freeze: auto
---

# Introduction

## Overview

This is a Quarto document for ${projectName}. Replace this text with a short summary of the question
the analysis answers and why it matters.

## Data

\`\`\`{r}
#| label: load-data
#| include: false

# Load required libraries
library(tidyverse)
library(knitr)

# Load or create your data here
# data <- read.csv("data.csv")
\`\`\`

## Analysis

Describe your approach here: which variables you look at first and which methods you use.

\`\`\`{r}
#| label: exploratory-analysis

# Exploratory data analysis
# summary(data)
\`\`\`

## Results

Explain what the figure below shows and what a reader should take from it.

\`\`\`{r}
#| label: create-figure
#| fig-cap: "Your figure caption here"

# Create visualizations
# ggplot(data, aes(x = variable)) +
#   geom_histogram() +
#   theme_minimal()
\`\`\`

## Conclusion

Summarize your findings here.
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Quarto document for data analysis.

## Rendering

To render this document to HTML:

\`\`\`bash
quarto render analysis.qmd
\`\`\`

Or in R:

\`\`\`r
quarto::quarto_render("analysis.qmd")
\`\`\`

## Requirements

- Quarto
- R >= 4.0.0
- tidyverse package
`,
      },
    ],
    directories: [],
  };
}
