library(shiny)

# UI Definition
ui <- fluidPage(
  titlePanel("Example Shiny App - Best Practices"),

  sidebarLayout(
    sidebarPanel(
      h3("Options"),
      numericInput(
        "n_samples",
        "Number of samples:",
        value = 100,
        min = 10,
        max = 1000
      ),
      numericInput(
        "mean",
        "Mean value:",
        value = 0,
        step = 0.1
      ),
      numericInput(
        "sd",
        "Standard deviation:",
        value = 1,
        min = 0.1,
        step = 0.1
      ),
      actionButton("generate", "Generate Data", class = "btn-primary"),
      hr(),
      p("Click 'Generate Data' to create a new sample.")
    ),

    mainPanel(
      tabsetPanel(
        tabPanel(
          "Plot",
          plotOutput("histogram")
        ),
        tabPanel(
          "Statistics",
          tableOutput("stats_table")
        ),
        tabPanel(
          "Data",
          dataTableOutput("data_table")
        )
      )
    )
  )
)

# Server Definition
server <- function(input, output, session) {
  # Reactive value to store data
  data_store <- reactiveVal(NULL)

  # Generate data on button click
  observeEvent(input$generate, {
    validate_inputs(input$n_samples, input$mean, input$sd)

    new_data <- rnorm(
      input$n_samples,
      mean = input$mean,
      sd = input$sd
    )
    data_store(new_data)
  })

  # Render histogram
  output$histogram <- renderPlot({
    data <- data_store()
    if (is.null(data)) {
      return(
        plot(1, type = "n", main = "No data generated yet",
             xlab = "", ylab = "")
      )
    }

    hist(data,
         main = "Distribution of Generated Data",
         xlab = "Value",
         ylab = "Frequency",
         col = "steelblue")
  })

  # Render statistics table
  output$stats_table <- renderTable({
    data <- data_store()
    if (is.null(data)) {
      return(data.frame(Statistic = "N/A", Value = "No data"))
    }

    data.frame(
      Statistic = c("Count", "Mean", "Median", "SD", "Min", "Max"),
      Value = c(
        length(data),
        round(mean(data), 3),
        round(median(data), 3),
        round(sd(data), 3),
        round(min(data), 3),
        round(max(data), 3)
      )
    )
  })

  # Render data table
  output$data_table <- renderDataTable({
    data <- data_store()
    if (is.null(data)) {
      return(data.frame())
    }

    data.frame(
      Index = seq_along(data),
      Value = round(data, 3)
    )
  })
}

# Run the application
shinyApp(ui = ui, server = server)

# Helper function for input validation
validate_inputs <- function(n_samples, mean, sd) {
  if (n_samples < 10 || n_samples > 1000) {
    stop("Number of samples must be between 10 and 1000")
  }
  if (sd <= 0) {
    stop("Standard deviation must be positive")
  }
  invisible(TRUE)
}
