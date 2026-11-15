import { TemplateFile, TemplateGeneratorOptions } from '../../types/template.js';

export function generateRenv(_options: TemplateGeneratorOptions): {
  files: TemplateFile[];
  directories: string[];
} {
  return {
    files: [
      {
        path: 'renv.lock',
        content: `{
  "R": {
    "Version": "4.3.0",
    "Repositories": [
      {
        "Name": "CRAN",
        "URL": "https://cran.rstudio.com"
      }
    ]
  },
  "Packages": {}
}
`,
      },
      {
        path: '.Rprofile',
        content: `# renv::init() creates renv/activate.R; until then there is nothing to activate.
if (file.exists("renv/activate.R")) source("renv/activate.R")
`,
      },
      {
        path: 'README.md',
        content: `# Project with renv

This project uses renv for dependency management.

## Setup

Initialize the project environment:

\`\`\`r
renv::init()
\`\`\`

## Installing Packages

\`\`\`r
# Install packages
install.packages("package_name")

# Snapshot dependencies
renv::snapshot()
\`\`\`

## Restoring Environment

To restore the exact environment from renv.lock:

\`\`\`r
renv::restore()
\`\`\`

## Documentation

See [renv documentation](https://rstudio.github.io/renv/) for more information.
`,
      },
    ],
    directories: [],
  };
}
