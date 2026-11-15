import { TemplateFile, TemplateGeneratorOptions } from '../../types/template.js';

export function generateAnalysis(options: TemplateGeneratorOptions): {
  files: TemplateFile[];
  directories: string[];
} {
  const projectName = options.projectName || 'analysis';

  return {
    files: [
      {
        path: 'README.md',
        content: `# ${projectName}

Data analysis project.

## Directory Structure

\`\`\`
${projectName}/
├── data/              # Raw data files
├── R/                 # R scripts and functions
├── output/            # Generated results and figures
├── analysis.qmd       # Main analysis document
└── README.md          # This file
\`\`\`

## Getting Started

1. Place raw data in the \`data/\` directory
2. Write analysis code in R scripts
3. Document analysis in \`analysis.qmd\`
4. Output results to \`output/\`

## Running the Analysis

\`\`\`r
# Source all R scripts
sapply(list.files("R", full.names = TRUE), source)

# Run analysis
# Your analysis code here
\`\`\`

Or render the Quarto document:

\`\`\`bash
quarto render analysis.qmd
\`\`\`

## Version Control

Use \`.gitignore\` to exclude large data files and outputs.
`,
      },
      {
        path: '.gitignore',
        content: `# Data
data/*.csv
data/*.xlsx
data/*.txt

# Output
output/
*.png
*.pdf
*.html

# R
.Rhistory
.RData
.Rproj.user/
*.Rproj

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
`,
      },
      {
        path: 'analysis.qmd',
        content: `---
title: "${projectName}"
author: "${options.authorName || 'Author Name'}"
date: today
format: html
---

# ${projectName}

## Overview

## Data

## Analysis

## Results

## Conclusion
`,
      },
      {
        path: 'R/.gitkeep',
        content: '',
      },
    ],
    directories: ['data', 'R', 'output'],
  };
}
