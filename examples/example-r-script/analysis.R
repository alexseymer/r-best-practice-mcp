#' Data Analysis Script
#'
#' Purpose: Demonstrate R script best practices
#' Author: Example Developer
#' Date: 2026-09-26
#' Description: This script shows recommended practices for R scripts
#' ==============================================================

# Setup and configuration
library(tidyverse)

# Main analysis function
analyze_data <- function(data, threshold = 0.5) {
  # Input validation
  if (!is.data.frame(data)) {
    stop("Input must be a data frame")
  }

  # Process data
  result <- data %>%
    filter(value > threshold) %>%
    mutate(
      log_value = log(value),
      category = case_when(
        value > 100 ~ "high",
        value > 50 ~ "medium",
        TRUE ~ "low"
      )
    ) %>%
    group_by(category) %>%
    summarize(
      count = n(),
      mean_value = mean(value),
      .groups = "drop"
    )

  return(result)
}

# Helper function for plotting
plot_results <- function(data) {
  ggplot(data, aes(x = category, y = mean_value, fill = category)) +
    geom_col() +
    theme_minimal() +
    labs(title = "Mean Values by Category",
         x = "Category",
         y = "Mean Value")
}

# Main execution
if (!interactive()) {
  # Load sample data
  sample_data <- data.frame(
    id = 1:100,
    value = rnorm(100, mean = 75, sd = 25)
  )

  # Run analysis
  results <- analyze_data(sample_data, threshold = 50)

  # Display results
  print(results)

  # Save plot
  png("output/results.png", width = 800, height = 600)
  print(plot_results(results))
  dev.off()
}
