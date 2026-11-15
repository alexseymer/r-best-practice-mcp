import { TemplateFile, TemplateGeneratorOptions } from '../../types/template.js';

export function generateRMarkdown(options: TemplateGeneratorOptions): {
  files: TemplateFile[];
  directories: string[];
} {
  const projectName = options.projectName || 'report';

  return {
    files: [
      {
        path: 'report.Rmd',
        content: `---
title: "${projectName} Report"
author: "${options.authorName || 'Author Name'}"
date: "\`r Sys.Date()\`"
output:
  html_document:
    toc: true
    toc_float: true
---

\`\`\`{r setup, include=FALSE}
knitr::opts_chunk$set(echo = TRUE)
library(tidyverse)
\`\`\`

# Introduction

This is an R Markdown document for ${projectName}.

## Data Loading

\`\`\`{r load-data}
# Load your data here
# data <- read.csv("data.csv")
\`\`\`

# Analysis

\`\`\`{r analysis}
# Perform analysis
# summary(data)
\`\`\`

# Results

\`\`\`{r results, echo=FALSE}
# Display results
# knitr::kable(head(data))
\`\`\`

# Conclusion

Summary of findings.
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

R Markdown report.

## Rendering

To render this document:

\`\`\`r
rmarkdown::render("report.Rmd")
\`\`\`

## Requirements

- R >= 4.0.0
- rmarkdown package
- knitr package
`,
      },
    ],
    directories: [],
  };
}
