import { TemplateFile, TemplateGeneratorOptions } from '../../types/template.js';

export function generateTargets(options: TemplateGeneratorOptions): {
  files: TemplateFile[];
  directories: string[];
} {
  const projectName = options.projectName || 'pipeline';

  return {
    files: [
      {
        path: '_targets.R',
        content: `# Created on ${new Date().toISOString().split('T')[0]}
library(targets)
library(tarchetypes)

# Set target options
tar_option_set(
  packages = c("tidyverse", "readr"),
  format = "qs"
)

# Define functions
create_data <- function() {
  data.frame(x = 1:10, y = rnorm(10))
}

analyze_data <- function(data) {
  list(
    mean = mean(data$y),
    sd = sd(data$y)
  )
}

# Define pipeline
list(
  tar_target(data, create_data()),
  tar_target(results, analyze_data(data))
)
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

targets pipeline for reproducible analysis.

## Running the Pipeline

To execute the pipeline:

\`\`\`r
targets::tar_make()
\`\`\`

To view the pipeline graph:

\`\`\`r
targets::tar_visnetwork()
\`\`\`

To load results:

\`\`\`r
results <- tar_read(results)
\`\`\`

## Requirements

- R >= 4.0.0
- targets package
- tarchetypes package

## Documentation

See [targets documentation](https://docs.ropensci.org/targets/) for more information.
`,
      },
    ],
    directories: [],
  };
}
