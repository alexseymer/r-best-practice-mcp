#' Run Validation via MCP Server
#'
#' Calls the R Best Practices MCP server to validate a project
#'
#' @param project_path Path to the R project to validate
#'
#' @return List with validation results or NULL on error
#' @keywords internal
run_validation <- function(project_path) {
  tryCatch({
    # Prepare JSON request for MCP server
    request <- jsonlite::toJSON(list(
      jsonrpc = "2.0",
      id = 1,
      method = "tools/call",
      params = list(
        name = "validate_project",
        arguments = list(
          path = project_path,
          workflow = "auto",
          options = list(
            limit = 100,
            severity = NULL,
            category = NULL
          )
        )
      )
    ), auto_unbox = TRUE)

    # Call MCP server via processx
    result <- processx::run(
      "node",
      c("-e", "console.log(require('readline').createInterface({input: process.stdin}).on('line', line => console.log(line)))"),
      stdin = request,
      timeout = 30
    )

    if (result$status != 0) {
      warning("MCP server call failed")
      return(NULL)
    }

    # Parse response
    response <- jsonlite::fromJSON(result$stdout)

    if (!is.null(response$error)) {
      warning("MCP server error: ", response$error$message)
      return(NULL)
    }

    # Extract and structure validation result
    findings <- response$result$findings %||% list()

    # Transform findings to expected structure
    findings_list <- lapply(findings, function(f) {
      list(
        id = f$id,
        severity = f$severity,
        category = f$category,
        message = f$message,
        suggestions = f$suggestions,
        file = f$file,
        line = f$line
      )
    })

    list(
      workflow = response$result$workflow,
      findings = findings_list,
      duration = response$result$duration %||% 0
    )
  }, error = function(e) {
    warning("Validation error: ", e$message)
    NULL
  })
}

#' Run Workflow Detection via MCP Server
#'
#' Calls the R Best Practices MCP server to detect workflow type
#'
#' @param project_path Path to the R project
#'
#' @return List with workflow, confidence, and indicators, or NULL on error
#' @keywords internal
run_workflow_detection <- function(project_path) {
  tryCatch({
    # Prepare JSON request
    request <- jsonlite::toJSON(list(
      jsonrpc = "2.0",
      id = 2,
      method = "tools/call",
      params = list(
        name = "detect_workflow",
        arguments = list(
          path = project_path
        )
      )
    ), auto_unbox = TRUE)

    # Call MCP server
    result <- processx::run(
      "node",
      c("-e", "console.log(require('readline').createInterface({input: process.stdin}).on('line', line => console.log(line)))"),
      stdin = request,
      timeout = 30
    )

    if (result$status != 0) {
      warning("MCP server call failed")
      return(NULL)
    }

    response <- jsonlite::fromJSON(result$stdout)

    if (!is.null(response$error)) {
      warning("MCP server error: ", response$error$message)
      return(NULL)
    }

    list(
      workflow = response$result$workflow,
      confidence = response$result$confidence,
      indicators = response$result$indicators
    )
  }, error = function(e) {
    warning("Detection error: ", e$message)
    NULL
  })
}

#' Run Template Generation via MCP Server
#'
#' Calls the R Best Practices MCP server to generate a project template
#'
#' @param workflow Workflow type (e.g., "package", "shiny")
#' @param project_name Project name
#' @param author_name Author name (optional)
#' @param author_email Author email (optional)
#' @param output_dir Output directory for generated files
#'
#' @return List with success status and created files, or NULL on error
#' @keywords internal
run_template_generation <- function(workflow, project_name, author_name, author_email, output_dir) {
  tryCatch({
    # Prepare JSON request
    request <- jsonlite::toJSON(list(
      jsonrpc = "2.0",
      id = 3,
      method = "tools/call",
      params = list(
        name = "generate_template",
        arguments = list(
          workflow = workflow,
          options = list(
            projectName = project_name,
            author = if (nzchar(author_name)) author_name else NULL,
            email = if (nzchar(author_email)) author_email else NULL
          )
        )
      )
    ), auto_unbox = TRUE)

    # Call MCP server
    result <- processx::run(
      "node",
      c("-e", "console.log(require('readline').createInterface({input: process.stdin}).on('line', line => console.log(line)))"),
      stdin = request,
      timeout = 30
    )

    if (result$status != 0) {
      warning("MCP server call failed")
      return(NULL)
    }

    response <- jsonlite::fromJSON(result$stdout)

    if (!is.null(response$error)) {
      warning("MCP server error: ", response$error$message)
      return(NULL)
    }

    template <- response$result

    # Create directories and write files
    project_dir <- file.path(output_dir, project_name)
    dir.create(project_dir, showWarnings = FALSE, recursive = TRUE)

    # Create subdirectories
    if (!is.null(template$directories)) {
      for (dir in template$directories) {
        dir.create(file.path(project_dir, dir), showWarnings = FALSE, recursive = TRUE)
      }
    }

    # Write files
    created_files <- character()
    if (!is.null(template$files)) {
      for (file in template$files) {
        file_path <- file.path(project_dir, file$path)
        dir.create(dirname(file_path), showWarnings = FALSE, recursive = TRUE)
        writeLines(file$content, file_path)
        created_files <- c(created_files, file_path)
      }
    }

    list(
      success = TRUE,
      directory = project_dir,
      files_created = length(created_files)
    )
  }, error = function(e) {
    warning("Template generation error: ", e$message)
    list(success = FALSE)
  })
}

#' Format Findings for Display in Data Table
#'
#' Converts Finding objects to a data frame suitable for DT::datatable display
#'
#' @param findings List of Finding objects from validation
#'
#' @return Data frame with findings formatted for display
#' @keywords internal
format_findings_for_display <- function(findings) {
  if (is.null(findings) || length(findings) == 0) {
    return(data.frame(
      Severity = character(),
      Category = character(),
      Message = character(),
      File = character(),
      Line = numeric(),
      Suggestions = character(),
      stringsAsFactors = FALSE
    ))
  }

  # Convert list of findings to data frame
  findings_df <- do.call(rbind, lapply(findings, function(f) {
    suggestions_text <- if (!is.null(f$suggestions) && length(f$suggestions) > 0) {
      paste(f$suggestions, collapse = "; ")
    } else {
      ""
    }

    data.frame(
      Severity = f$severity,
      Category = f$category,
      Message = f$message,
      File = f$file %||% "",
      Line = f$line %||% NA,
      Suggestions = suggestions_text,
      stringsAsFactors = FALSE
    )
  }))

  rownames(findings_df) <- NULL
  findings_df
}

#' Create a Spinning Loader
#'
#' Returns HTML for a loading spinner
#'
#' @return Shiny HTML tag for spinner
#' @keywords internal
spinner_gif <- function() {
  shiny::div(
    shiny::HTML("&#9679;"),
    style = "font-size: 24px; animation: spin 1s linear infinite;",
    shiny::tags$style("
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    ")
  )
}

#' %||% Operator for NULL coalescing
#'
#' Returns left value if not NULL, otherwise right value
#'
#' @param x Left value
#' @param y Right value
#'
#' @return x if not NULL, else y
#' @keywords internal
`%||%` <- function(x, y) {
  if (is.null(x)) y else x
}
