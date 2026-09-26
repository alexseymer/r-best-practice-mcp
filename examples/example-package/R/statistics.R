#' Calculate Statistical Summary
#'
#' Computes mean, median, and standard deviation for numeric input.
#'
#' @param data A numeric vector or data frame column
#' @param na.rm Logical; if TRUE, removes NA values before calculation
#'
#' @return A list with components:
#'   \item{mean}{Mean value}
#'   \item{median}{Median value}
#'   \item{sd}{Standard deviation}
#'   \item{n}{Number of observations}
#'
#' @examples
#' calculate_statistics(c(1, 2, 3, 4, 5))
#' calculate_statistics(rnorm(100))
#'
#' @export
calculate_statistics <- function(data, na.rm = TRUE) {
  # Input validation
  validate_input(data, "numeric")

  # Remove NA if requested
  if (na.rm) {
    data <- data[!is.na(data)]
  }

  # Calculate statistics
  list(
    mean = mean(data, na.rm = na.rm),
    median = median(data, na.rm = na.rm),
    sd = sd(data, na.rm = na.rm),
    n = length(data)
  )
}

#' Validate Input Data
#'
#' Checks that input is of expected type and raises informative errors.
#'
#' @param data Object to validate
#' @param expected_type Expected type as string ("numeric", "character", etc.)
#'
#' @return Invisibly returns TRUE if valid, otherwise raises error
#'
#' @keywords internal
#' @export
validate_input <- function(data, expected_type) {
  # Type checking
  if (!inherits(data, expected_type)) {
    rlang::abort(
      paste("Expected", expected_type, "but got", typeof(data)),
      class = "input_type_error"
    )
  }

  # Length checking
  if (length(data) == 0) {
    rlang::warn("Input is empty vector")
  }

  invisible(TRUE)
}
