import { Workflow } from '../types/workflow.js';
import { GeneratedTemplate, TemplateFile, TemplateGeneratorOptions } from '../types/template.js';
import { logger } from '../utils/logger.js';

export class TemplateGenerator {
  async generate(
    workflow: Workflow,
    options: TemplateGeneratorOptions = {}
  ): Promise<GeneratedTemplate> {
    const startTime = Date.now();
    logger.info(`Generating template for ${workflow}`, options);

    let files: TemplateFile[] = [];
    let directories: string[] = [];

    switch (workflow) {
      case 'r-script':
        ({ files, directories } = this.generateRScript(options));
        break;
      case 'quarto':
        ({ files, directories } = this.generateQuarto(options));
        break;
      case 'shiny':
        ({ files, directories } = this.generateShiny(options));
        break;
      case 'package':
        ({ files, directories } = this.generatePackage(options));
        break;
      case 'rmarkdown':
        ({ files, directories } = this.generateRMarkdown(options));
        break;
      case 'renv':
        ({ files, directories } = this.generateRenv(options));
        break;
      case 'targets':
        ({ files, directories } = this.generateTargets(options));
        break;
      case 'plumber':
        ({ files, directories } = this.generatePlumber(options));
        break;
      case 'analysis':
        ({ files, directories } = this.generateAnalysis(options));
        break;
      default:
        logger.warn(`Unknown workflow: ${workflow}`);
    }

    logger.info(`Generated ${files.length} files for ${workflow}`);

    return {
      workflow,
      files,
      directories,
      timestamp: Date.now(),
    };
  }

  private generateRScript(options: TemplateGeneratorOptions): { files: TemplateFile[]; directories: string[] } {
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

  private generateQuarto(options: TemplateGeneratorOptions): { files: TemplateFile[]; directories: string[] } {
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
---

# Introduction

## Overview

This is a Quarto document for ${projectName}.

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

\`\`\`{r}
#| label: exploratory-analysis

# Exploratory data analysis
# summary(data)
\`\`\`

## Results

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

  private generateShiny(options: TemplateGeneratorOptions): { files: TemplateFile[]; directories: string[] } {
    const projectName = options.projectName || 'my-app';

    return {
      files: [
        {
          path: 'app.R',
          content: `library(shiny)

# ============================================================================
# UI Definition
# ============================================================================

ui <- fluidPage(
  titlePanel("${projectName}"),

  sidebarLayout(
    sidebarPanel(
      h3("Controls"),
      # Add input controls here
      # sliderInput("slider", "Choose value:", min = 0, max = 100, value = 50),
      # textInput("name", "Enter name:", ""),
      actionButton("go", "Run Analysis")
    ),

    mainPanel(
      h3("Results"),
      # Add output elements here
      # plotOutput("plot"),
      # tableOutput("table"),
      textOutput("text_output")
    )
  )
)

# ============================================================================
# Server Logic
# ============================================================================

server <- function(input, output, session) {

  # Reactive values
  reactive_data <- reactiveVal(NULL)

  # Event handlers
  observeEvent(input\\$go, {
    cat("Analysis started\\n")
    # Perform analysis
    reactive_data(data.frame(result = "Your results here"))
  })

  # Outputs
  output\\$text_output <- renderText({
    paste("Ready to analyze. Click 'Run Analysis' to start.")
  })

}

# ============================================================================
# Run the app
# ============================================================================

shinyApp(ui = ui, server = server)
`,
        },
        {
          path: 'README.md',
          content: `# ${projectName}

Shiny application for interactive analysis.

## Running the App

In R:

\`\`\`r
library(shiny)
runApp()
\`\`\`

Or from command line:

\`\`\`bash
Rscript -e "shiny::runApp()"
\`\`\`

## Requirements

- R >= 4.0.0
- shiny package

## Installation

\`\`\`r
install.packages("shiny")
\`\`\`

## Author
${options.authorName || 'Author Name'}
`,
        },
      ],
      directories: [],
    };
  }

  private generatePackage(options: TemplateGeneratorOptions): { files: TemplateFile[]; directories: string[] } {
    const projectName = options.projectName || 'mypackage';
    const authorName = options.authorName || 'Author Name';
    const authorEmail = options.authorEmail || 'author@example.com';

    return {
      files: [
        {
          path: 'DESCRIPTION',
          content: `Package: ${projectName}
Version: 0.1.0
Title: Brief Title of Your Package
Description: A longer description of what your package does.
    It can span multiple lines.
Authors@R:
    person("${authorName}", "${authorEmail}", role = c("aut", "cre"))
License: MIT + file LICENSE
Encoding: UTF-8
Roxygen: list(markdown = TRUE)
RoxygenNote: 7.2.0
Imports:
    rlang,
    cli
Suggests:
    testthat (>= 3.0.0)
`,
        },
        {
          path: 'LICENSE',
          content: `MIT License

Copyright (c) 2026 ${authorName}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
`,
        },
        {
          path: 'R/hello.R',
          content: `#' Hello World Function
#'
#' @description
#' A simple hello world function to demonstrate package structure.
#'
#' @param name Character string with name to greet.
#'
#' @return Character string with greeting.
#'
#' @export
#'
#' @examples
#' hello("World")
#'
hello <- function(name = "World") {
  paste0("Hello, ", name, "!")
}
`,
        },
        {
          path: 'README.md',
          content: `# ${projectName}

<!-- badges: start -->
<!-- badges: end -->

The goal of ${projectName} is to provide useful functionality for R users.

## Installation

You can install the development version of ${projectName} from GitHub with:

\`\`\`r
# install.packages("devtools")
devtools::install_github("${authorName}/${projectName}")
\`\`\`

## Usage

\`\`\`r
library(${projectName})

# Use the package
hello("User")
\`\`\`

## Development

To build documentation:

\`\`\`r
devtools::document()
\`\`\`

To run tests:

\`\`\`r
devtools::test()
\`\`\`

To check the package:

\`\`\`r
devtools::check()
\`\`\`
`,
        },
        {
          path: 'tests/testthat/test-hello.R',
          content: `test_that("hello returns correct greeting", {
  result <- hello("World")
  expect_equal(result, "Hello, World!")
})

test_that("hello uses default name", {
  result <- hello()
  expect_equal(result, "Hello, World!")
})
`,
        },
        {
          path: 'man/.gitkeep',
          content: '',
        },
      ],
      directories: ['R', 'tests/testthat', 'man'],
    };
  }

  private generateRMarkdown(options: TemplateGeneratorOptions): { files: TemplateFile[]; directories: string[] } {
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
knitr::opts_chunk\\$set(echo = TRUE)
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

  private generateRenv(options: TemplateGeneratorOptions): { files: TemplateFile[]; directories: string[] } {
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
          content: `source("renv/activate.R")
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

  private generateTargets(options: TemplateGeneratorOptions): { files: TemplateFile[]; directories: string[] } {
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
    mean = mean(data\\$y),
    sd = sd(data\\$y)
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

  private generatePlumber(options: TemplateGeneratorOptions): { files: TemplateFile[]; directories: string[] } {
    const projectName = options.projectName || 'api';

    return {
      files: [
        {
          path: 'api.R',
          content: `library(plumber)

# Validate input
validate_input <- function(x) {
  if (is.na(x) || x < 0) {
    stop("Input must be a positive number")
  }
  TRUE
}

#* @apiTitle ${projectName} API
#* @apiDescription API for demonstrating Plumber functionality

#* @get /hello
#* @param name:string Name to greet
function(name = "World") {
  list(message = paste0("Hello, ", name, "!"))
}

#* @post /add
#* @param a:numeric First number
#* @param b:numeric Second number
function(a, b) {
  tryCatch({
    validate_input(a)
    validate_input(b)
    list(result = a + b)
  }, error = function(e) {
    list(error = TRUE, message = e\\$message)
  })
}

#* @get /status
function() {
  list(
    status = "healthy",
    timestamp = Sys.time()
  )
}
`,
        },
        {
          path: 'run.R',
          content: `library(plumber)

# Load the API
pr <- plumb_file("api.R")

# Run the server
pr\\$run(host = "127.0.0.1", port = 8000)
`,
        },
        {
          path: 'README.md',
          content: `# ${projectName}

Plumber REST API.

## Running the API

\`\`\`bash
Rscript run.R
\`\`\`

The API will be available at http://localhost:8000

## Endpoints

### GET /hello
\`\`\`bash
curl "http://localhost:8000/hello?name=Alice"
\`\`\`

### POST /add
\`\`\`bash
curl -X POST "http://localhost:8000/add?a=5&b=3"
\`\`\`

### GET /status
\`\`\`bash
curl "http://localhost:8000/status"
\`\`\`

## Requirements

- R >= 4.0.0
- plumber package

## Documentation

See [Plumber documentation](https://www.rplumber.io/) for more information.
`,
        },
      ],
      directories: [],
    };
  }

  private generateAnalysis(options: TemplateGeneratorOptions): { files: TemplateFile[]; directories: string[] } {
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
}
