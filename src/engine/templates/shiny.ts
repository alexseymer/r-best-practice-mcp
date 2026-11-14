import { TemplateFile, TemplateGeneratorOptions } from '../../types/template.js';

export function generateShiny(options: TemplateGeneratorOptions): {
  files: TemplateFile[];
  directories: string[];
} {
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
  observeEvent(input$go, {
    cat("Analysis started\\n")
    # Perform analysis
    reactive_data(data.frame(result = "Your results here"))
  })

  # Outputs
  output$text_output <- renderText({
    validate(need(reactive_data(), "Ready to analyze. Click 'Run Analysis' to start."))
    reactive_data()$result
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
