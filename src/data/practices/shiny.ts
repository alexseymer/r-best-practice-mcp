import { Practice } from '../../types/practice.js';

export const shinyPractices: Practice[] = [
  {
    id: 'shiny-separation',
    title: 'Separate UI and server logic',
    workflow: 'shiny',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Use ui.R/server.R or modular app.R with clear sections',
    details:
      'A single long app.R that mixes layout, reactive logic and helper functions is hard to read, review and test. Keep the UI and server in clearly separated objects or files, and move helpers into R/. The automated check is a heuristic: it flags an app.R of more than 200 lines that defines both ui and server when the project has no R/ directory, no ui.R/server.R and no source() call.',
    badExample: `# app.R (400+ lines)
library(shiny)

ui <- fluidPage(
  # ...150 lines of layout...
)

server <- function(input, output, session) {
  # ...250 lines of reactives, outputs and helper functions...
}

shinyApp(ui, server)`,
    goodExample: `myapp/
  app.R          # library(shiny); shinyApp(ui, server)
  R/
    ui.R         # ui <- fluidPage(...)
    server.R     # server <- function(input, output, session) {...}
    helpers.R    # plain functions, no reactivity
    mod_plot.R   # module UI + server

# Files in R/ are sourced automatically by shiny::runApp() (Shiny >= 1.5).`,
    tags: ['structure', 'maintainability'],
    references: [
      'https://mastering-shiny.org/scaling-functions.html',
      'https://shiny.posit.co/r/articles/build/app-formats/',
    ],
  },
  {
    id: 'shiny-reactive',
    title: 'Use reactive() appropriately',
    workflow: 'shiny',
    category: 'performance',
    severity: 'important',
    enforcement: 'guidance',
    description: 'Wrap computed values in reactive() to avoid recalculation',
    details:
      'A reactive() expression caches its value and is recomputed only when its inputs change, so an expensive step shared by several outputs runs once. Without it, each output repeats the same computation. Use reactive() for values you compute and use elsewhere, and keep side effects out of it. This is guidance only and is not checked automatically.',
    badExample: `server <- function(input, output, session) {
  output$table <- renderTable({
    head(read.csv(input$path) |> subset(year == input$year))
  })
  output$plot <- renderPlot({
    d <- read.csv(input$path) |> subset(year == input$year)
    plot(d$x, d$y)
  })
}`,
    goodExample: `server <- function(input, output, session) {
  data <- reactive({
    req(input$path)
    read.csv(input$path) |> subset(year == input$year)
  })

  output$table <- renderTable(head(data()))
  output$plot <- renderPlot({
    plot(data()$x, data()$y)
  })
}`,
    references: [
      'https://mastering-shiny.org/basic-reactivity.html',
      'https://shiny.posit.co/r/reference/shiny/latest/reactive.html',
    ],
  },
  {
    id: 'shiny-observe',
    title: 'Use observe() for side effects',
    workflow: 'shiny',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'guidance',
    description: 'Use observe() or observeEvent() for actions without return value',
    details:
      'Observers exist for side effects such as updating inputs, writing files or showing notifications, while reactive() is for values you use elsewhere. Prefer observeEvent() so the code runs only when a specific trigger changes, and never rely on the return value of an observer. This is guidance only and is not checked automatically.',
    badExample: `server <- function(input, output, session) {
  # A reactive() used only for its side effect: it never runs
  # unless something else reads it
  save_log <- reactive({
    writeLines(input$note, "log.txt")
  })
}`,
    goodExample: `server <- function(input, output, session) {
  observeEvent(input$save, {
    writeLines(input$note, "log.txt")
    showNotification("Note saved")
  })

  observeEvent(input$reset, {
    updateTextInput(session, "note", value = "")
  })
}`,
    tags: ['reactive', 'side-effects'],
    references: [
      'https://shiny.posit.co/r/reference/shiny/latest/observeevent.html',
      'https://mastering-shiny.org/reactivity-objects.html',
    ],
  },
  {
    id: 'shiny-validation',
    title: 'Validate user inputs',
    workflow: 'shiny',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Check input validity before processing',
    details:
      'Inputs are empty or invalid at startup and whenever users make mistakes, which otherwise surfaces as cryptic R errors in the UI. Use req() to wait for required values, validate()/need() for friendly messages, or shinyvalidate/shinyFeedback for field-level checks. The automated check is a keyword heuristic: it flags apps whose source (app.R, ui.R, server.R, global.R, R/*.R) reads input$ but never contains req(, validate( (or a validate_*() helper), need(, InputValidator or shinyFeedback.',
    badExample: `server <- function(input, output, session) {
  output$hist <- renderPlot({
    hist(rnorm(input$n), main = input$title)
  })
}`,
    goodExample: `server <- function(input, output, session) {
  output$hist <- renderPlot({
    req(input$n)
    validate(need(input$n > 0, "Please choose a positive sample size"))
    hist(rnorm(input$n), main = input$title)
  })
}`,
    tags: ['validation', 'error-handling'],
    references: [
      'https://shiny.posit.co/r/reference/shiny/latest/req.html',
      'https://shiny.posit.co/r/reference/shiny/latest/validate.html',
      'https://rstudio.github.io/shinyvalidate/',
    ],
  },
  {
    id: 'shiny-modules',
    title: 'Use modules for complex apps',
    workflow: 'shiny',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Break large apps into reusable modules (callModule pattern)',
    details:
      'Modules give a piece of an app its own namespace so IDs cannot collide, and let you reuse and test it in isolation. Write a UI function taking an id and a server function using moduleServer(). The automated check is a size heuristic: it flags apps whose source (app.R, ui.R, server.R, global.R, R/*.R) has more than 300 lines in total and contains neither moduleServer( nor callModule(.',
    badExample: `# One server function with repeated, hand-prefixed ids
server <- function(input, output, session) {
  output$sales_plot <- renderPlot(plot(sales_data(input$sales_region)))
  output$costs_plot <- renderPlot(plot(costs_data(input$costs_region)))
  # ...hundreds more lines of near-identical blocks...
}`,
    goodExample: `regionPlotUI <- function(id) {
  ns <- NS(id)
  tagList(selectInput(ns("region"), "Region", c("EU", "US")), plotOutput(ns("plot")))
}

regionPlotServer <- function(id, get_data) {
  moduleServer(id, function(input, output, session) {
    output$plot <- renderPlot(plot(get_data(input$region)))
  })
}

# in server: regionPlotServer("sales", sales_data)`,
    tags: ['modules', 'reusability'],
    references: [
      'https://mastering-shiny.org/scaling-modules.html',
      'https://shiny.posit.co/r/articles/improve/modules/',
    ],
  },
  {
    id: 'shiny-feedback',
    title: 'Provide user feedback and status',
    workflow: 'shiny',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'guidance',
    description: 'Show loading indicators, messages, and error notifications',
    details:
      'Users cannot tell a slow computation from a broken app unless the UI says what is happening. Show progress for long tasks with withProgress(), confirm actions with showNotification(), and report failures with a readable message instead of a raw error. This is guidance only and is not checked automatically.',
    badExample: `server <- function(input, output, session) {
  observeEvent(input$run, {
    result <- run_slow_model(input$params)  # UI looks frozen
    saveRDS(result, "result.rds")
  })
}`,
    goodExample: `server <- function(input, output, session) {
  observeEvent(input$run, {
    result <- withProgress(message = "Fitting model", {
      run_slow_model(input$params)
    })
    saveRDS(result, "result.rds")
    showNotification("Model saved", type = "message")
  })
}`,
    tags: ['ux', 'feedback'],
    references: [
      'https://mastering-shiny.org/action-feedback.html',
      'https://shiny.posit.co/r/reference/shiny/latest/withprogress.html',
    ],
  },
  {
    id: 'shiny-readme',
    title: 'Include README with usage instructions',
    workflow: 'shiny',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Document how to run the app and use its features',
    details:
      'A README tells new users and deployers what the app does, which packages it needs and how to start it. Include the purpose, install steps, the run command and any required data or environment variables. The automated check looks for README.md in the project root.',
    badExample: `myapp/
  app.R
  data/
    survey.csv`,
    goodExample: `myapp/
  README.md      # purpose, install.packages(...) line, shiny::runApp(), data notes
  app.R
  data/
    survey.csv

# README.md
# Survey explorer
Run locally: shiny::runApp("myapp")`,
    tags: ['documentation', 'readme'],
    references: [
      'https://shiny.posit.co/r/articles/build/app-formats/',
      'https://mastering-shiny.org/basic-app.html',
    ],
  },
  {
    id: 'shiny-structure',
    title: 'Use a standard Shiny app layout',
    workflow: 'shiny',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Provide app.R, or both ui.R and server.R, in the app directory',
    details:
      'Shiny and hosting platforms such as shinyapps.io and Posit Connect recognise an app by app.R or by the pair ui.R and server.R. Without them runApp() and deployment cannot find the app. The automated check reports a project that has neither app.R nor both ui.R and server.R in its root.',
    badExample: `myapp/
  my_dashboard.R
  helpers.R
  README.md`,
    goodExample: `myapp/
  app.R          # ends with shinyApp(ui, server)
  R/
    helpers.R
  README.md

# or the two-file layout
myapp/
  ui.R
  server.R`,
    tags: ['shiny', 'structure'],
    references: [
      'https://shiny.posit.co/r/articles/build/app-formats/',
      'https://mastering-shiny.org/basic-app.html',
    ],
  },
];
