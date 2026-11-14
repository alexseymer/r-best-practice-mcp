import { TemplateFile, TemplateGeneratorOptions } from '../../types/template.js';

export function generateShinytest(options: TemplateGeneratorOptions): {
  files: TemplateFile[];
  directories: string[];
} {
  const projectName = options.projectName || 'shinytest-app';

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
      h3("Test Inputs"),
      textInput("name", "Enter your name:", ""),
      numericInput("value", "Enter a number:", 42),
      actionButton("submit", "Submit"),
      id = "sidebar"
    ),

    mainPanel(
      h3("Results"),
      textOutput("greeting"),
      textOutput("result"),
      id = "main"
    )
  )
)

# ============================================================================
# Server Logic
# ============================================================================

server <- function(input, output, session) {

  observeEvent(input$submit, {
    # Process inputs
  })

  output$greeting <- renderText({
    if (nzchar(input$name)) {
      paste("Hello,", input$name, "!")
    } else {
      "Please enter your name"
    }
  })

  output$result <- renderText({
    paste("You entered:", input$value)
  })

}

# ============================================================================
# Run the app
# ============================================================================

shinyApp(ui = ui, server = server)
`,
      },
      {
        path: 'tests/testthat/setup-shinytest.R',
        content: `# Setup for shinytest2 tests
library(shinytest2)
library(testthat)
`,
      },
      {
        path: 'tests/testthat/test-app.R',
        content: `test_that("app starts and shows the default greeting", {
  app <- AppDriver$new(app_dir = "../..", name = "start")
  on.exit(app$stop(), add = TRUE)

  app$expect_values()
})

test_that("greeting updates on input", {
  app <- AppDriver$new(app_dir = "../..", name = "greeting")
  on.exit(app$stop(), add = TRUE)

  app$set_inputs(name = "Test")
  app$click("submit")

  app$expect_values(output = "greeting")
})
`,
      },
      {
        path: '.github/workflows/test-app.yaml',
        content: `name: test-app

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: r-lib/actions/setup-r@v2
        with:
          use-public-rspm: true
      - uses: r-lib/actions/setup-r-dependencies@v2
        with:
          extra-packages: any::shiny, any::shinytest2, any::testthat
      - name: Run tests
        run: Rscript -e 'testthat::test_dir("tests/testthat")'
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Shiny application with shinytest testing.

## Running the App

\`\`\`r
shiny::runApp()
\`\`\`

## Running Tests

To run all tests:

\`\`\`r
testthat::test_dir("tests/")
\`\`\`

Or run the app tests only:

\`\`\`r
shinytest2::test_app()
\`\`\`

## Recording New Tests

Record an interaction as a new test:

\`\`\`r
shinytest2::record_test()
\`\`\`

## Project Structure

- \`app.R\` - Main Shiny application
- \`.github/workflows/test-app.yaml\` - Runs the tests on every push
- \`tests/testthat/\` - Unit tests with testthat

## Requirements

- R >= 4.0.0
- shiny package
- shinytest2 package
- testthat package

## Testing Best Practices

1. Record interactive tests with shinytest2 for UI workflows
2. Write unit tests with testthat for business logic
3. Test both happy paths and error cases
4. Use meaningful test descriptions
`,
      },
      {
        path: '.gitignore',
        content: `# shinytest2 (keep tests/testthat/_snaps/, ignore local failures)
tests/testthat/_snaps/**/*.new.*

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
    ],
    directories: ['tests/testthat', '.github/workflows'],
  };
}
