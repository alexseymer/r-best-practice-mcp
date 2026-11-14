import { TemplateFile, TemplateGeneratorOptions } from '../../types/template.js';

export function generateRScript(options: TemplateGeneratorOptions): {
  files: TemplateFile[];
  directories: string[];
} {
  const projectName = options.projectName || 'my-script';
  const authorName = options.authorName || 'Author Name';
  const authorEmail = options.authorEmail || 'author@example.com';

  return {
    files: [
      {
        path: 'script.R',
        content: `# Purpose: Main R script for ${projectName}
# Author: ${authorName} <${authorEmail}>
# Date: ${new Date().toISOString().split('T')[0]}

# Load libraries
# library(tidyverse)
# library(ggplot2)

# ============================================================================
# Main execution
# ============================================================================

main <- function() {
  cat("Script starting...\\n")

  # Your code here

  cat("Script complete!\\n")
}

if (!interactive()) {
  main()
}
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

## Description
Brief description of what this script does.

## Requirements
- R >= 4.0.0
- Required packages: tidyverse, ggplot2

## Installation

\`\`\`r
# Install required packages
install.packages(c("tidyverse", "ggplot2"))
\`\`\`

## Usage

\`\`\`bash
Rscript script.R
\`\`\`

Or in R:

\`\`\`r
source("script.R")
main()
\`\`\`

## Author
${authorName} <${authorEmail}>
`,
      },
      {
        path: '.gitignore',
        content: `# R-specific files
.Rhistory
.RData
.Rproj.user/
*.Rproj

# Output files
output/
*.csv
*.xlsx
*.png
*.pdf

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
`,
      },
    ],
    directories: [],
  };
}
