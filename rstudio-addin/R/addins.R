#' Validate R Project - RStudio Addin
#'
#' Opens an RStudio addin dialog for validating the current project against
#' best practices using the R Best Practices MCP server.
#'
#' @export
#' @examples
#' \dontrun{
#'   validate_project_addin()
#' }
validate_project_addin <- function() {
  project_path <- rstudioapi::getActiveProject()

  if (is.null(project_path)) {
    rstudioapi::showDialog(
      title = "No Project",
      message = "Please open an RStudio project first."
    )
    return(invisible(NULL))
  }

  ui <- miniUI::miniPage(
    miniUI::gadgetTitleBar("R Best Practices - Project Validation"),
    miniUI::miniContentPanel(
      shiny::tabsetPanel(
        shiny::tabPanel(
          "Validation",
          shiny::div(
            id = "validation-panel",
            shiny::p("Validating project..."),
            shiny::uiOutput("validation_spinner")
          )
        ),
        shiny::tabPanel(
          "Findings",
          DT::DTOutput("findings_table")
        ),
        shiny::tabPanel(
          "Statistics",
          shiny::verbatimTextOutput("validation_stats")
        )
      )
    )
  )

  server <- function(input, output, session) {
    # Reactive value to store validation results
    validation_result <- shiny::reactiveVal(NULL)

    # Run validation on startup
    shiny::observe({
      result <- run_validation(project_path)
      validation_result(result)
    })

    # Render validation spinner
    output$validation_spinner <- shiny::renderUI({
      if (is.null(validation_result())) {
        return(shiny::div(
          shiny::spinner_gif(),
          style = "text-align: center; margin-top: 20px;"
        ))
      }
      shiny::div()
    })

    # Render findings table
    output$findings_table <- DT::renderDT({
      result <- validation_result()
      if (is.null(result) || is.null(result$findings)) {
        return(data.frame(Message = "No findings yet..."))
      }

      findings_df <- format_findings_for_display(result$findings)
      DT::datatable(
        findings_df,
        options = list(pageLength = 10),
        selection = "single"
      )
    })

    # Render statistics
    output$validation_stats <- shiny::renderText({
      result <- validation_result()
      if (is.null(result)) return("Waiting for validation...")

      findings <- result$findings
      if (is.null(findings)) {
        return("No issues found!")
      }

      critical <- sum(sapply(findings, function(f) f$severity == "critical"))
      important <- sum(sapply(findings, function(f) f$severity == "important"))
      recommended <- sum(sapply(findings, function(f) f$severity == "recommended"))
      info <- sum(sapply(findings, function(f) f$severity == "info"))

      sprintf(
        "Critical: %d | Important: %d | Recommended: %d | Info: %d\nTotal: %d findings\nDuration: %dms",
        critical, important, recommended, info, length(findings), result$duration
      )
    })
  }

  shiny::runGadget(ui, server, viewer = shiny::dialogViewer("R Best Practices"))
}

#' Detect Workflow Type - RStudio Addin
#'
#' Opens an RStudio addin dialog to detect the workflow type of the current project.
#'
#' @export
detect_workflow_addin <- function() {
  project_path <- rstudioapi::getActiveProject()

  if (is.null(project_path)) {
    rstudioapi::showDialog(
      title = "No Project",
      message = "Please open an RStudio project first."
    )
    return(invisible(NULL))
  }

  ui <- miniUI::miniPage(
    miniUI::gadgetTitleBar("Detect Workflow Type"),
    miniUI::miniContentPanel(
      shiny::uiOutput("workflow_content")
    )
  )

  server <- function(input, output, session) {
    detection <- shiny::reactive({
      run_workflow_detection(project_path)
    })

    output$workflow_content <- shiny::renderUI({
      result <- detection()
      if (is.null(result)) {
        return(shiny::p("Detecting..."))
      }

      shiny::div(
        shiny::h3("Detected Workflow"),
        shiny::p(
          shiny::strong("Type: "), result$workflow, shiny::br(),
          shiny::strong("Confidence: "), sprintf("%d%%", result$confidence), shiny::br(),
          shiny::strong("Indicators: "), paste(result$indicators, collapse = ", ")
        )
      )
    })
  }

  shiny::runGadget(ui, server, viewer = shiny::dialogViewer("Workflow Detection"))
}

#' Generate Template - RStudio Addin
#'
#' Opens an RStudio addin dialog to generate a new project template.
#'
#' @export
generate_template_addin <- function() {
  workflows <- c(
    "r-script", "quarto", "shiny", "package",
    "rmarkdown", "renv", "targets", "plumber", "analysis"
  )

  ui <- miniUI::miniPage(
    miniUI::gadgetTitleBar("Generate R Project Template"),
    miniUI::miniContentPanel(
      shiny::div(
        shiny::selectInput(
          "workflow",
          "Workflow Type:",
          choices = workflows
        ),
        shiny::textInput(
          "project_name",
          "Project Name:",
          value = "my-project"
        ),
        shiny::textInput(
          "author_name",
          "Author Name (optional):",
          value = ""
        ),
        shiny::textInput(
          "author_email",
          "Author Email (optional):",
          value = ""
        ),
        shiny::textInput(
          "output_dir",
          "Output Directory:",
          value = getwd()
        ),
        shiny::actionButton("generate_btn", "Generate Template", class = "btn-primary"),
        shiny::div(id = "status_message", style = "margin-top: 20px;")
      )
    )
  )

  server <- function(input, output, session) {
    shiny::observeEvent(input$generate_btn, {
      output_dir <- input$output_dir
      if (!dir.exists(output_dir)) {
        shiny::insertUI(
          selector = "#status_message",
          where = "replaceWith",
          ui = shiny::div(
            shiny::p("Output directory does not exist!", style = "color: red;")
          )
        )
        return()
      }

      result <- run_template_generation(
        input$workflow,
        input$project_name,
        input$author_name,
        input$author_email,
        output_dir
      )

      if (!is.null(result) && result$success) {
        shiny::insertUI(
          selector = "#status_message",
          where = "replaceWith",
          ui = shiny::div(
            shiny::p("✓ Template generated successfully!", style = "color: green;"),
            shiny::p(
              "Files created in: ",
              file.path(output_dir, input$project_name)
            )
          )
        )
      } else {
        shiny::insertUI(
          selector = "#status_message",
          where = "replaceWith",
          ui = shiny::div(
            shiny::p("✗ Template generation failed!", style = "color: red;")
          )
        )
      }
    })
  }

  shiny::runGadget(ui, server, viewer = shiny::dialogViewer("Generate Template"))
}

#' Show Validation Report - RStudio Addin
#'
#' Opens an RStudio addin dialog to show the validation report.
#'
#' @export
show_report_addin <- function() {
  project_path <- rstudioapi::getActiveProject()

  if (is.null(project_path)) {
    rstudioapi::showDialog(
      title = "No Project",
      message = "Please open an RStudio project first."
    )
    return(invisible(NULL))
  }

  ui <- miniUI::miniPage(
    miniUI::gadgetTitleBar("R Best Practices - Report"),
    miniUI::miniContentPanel(
      shiny::uiOutput("report_content")
    )
  )

  server <- function(input, output, session) {
    report_data <- shiny::reactive({
      run_validation(project_path)
    })

    output$report_content <- shiny::renderUI({
      result <- report_data()
      if (is.null(result)) {
        return(shiny::p("Loading report..."))
      }

      findings <- result$findings
      if (is.null(findings)) {
        findings <- list()
      }

      # Count by severity
      critical <- sum(sapply(findings, function(f) f$severity == "critical"))
      important <- sum(sapply(findings, function(f) f$severity == "important"))
      recommended <- sum(sapply(findings, function(f) f$severity == "recommended"))
      info <- sum(sapply(findings, function(f) f$severity == "info"))

      shiny::div(
        shiny::h3("Validation Summary"),
        shiny::div(
          shiny::tags$style(HTML("
            .stat-box {
              display: inline-block;
              margin: 10px;
              padding: 15px;
              border-radius: 4px;
              min-width: 120px;
              text-align: center;
            }
            .critical { background-color: #fee2e2; color: #dc2626; }
            .important { background-color: #ffedd5; color: #ea580c; }
            .recommended { background-color: #fef3c7; color: #eab308; }
            .info { background-color: #dbeafe; color: #2563eb; }
          ")),
          shiny::div(class = "stat-box critical",
                     shiny::h4(critical), shiny::p("Critical")),
          shiny::div(class = "stat-box important",
                     shiny::h4(important), shiny::p("Important")),
          shiny::div(class = "stat-box recommended",
                     shiny::h4(recommended), shiny::p("Recommended")),
          shiny::div(class = "stat-box info",
                     shiny::h4(info), shiny::p("Info"))
        ),
        shiny::hr(),
        shiny::h4("Findings"),
        if (length(findings) > 0) {
          DT::datatable(
            format_findings_for_display(findings),
            options = list(pageLength = 10)
          )
        } else {
          shiny::p("✓ No issues found!")
        }
      )
    })
  }

  shiny::runGadget(ui, server, viewer = shiny::paneViewer())
}
