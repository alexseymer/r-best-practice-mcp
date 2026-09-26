context("Statistics Functions")

test_that("calculate_statistics returns correct structure", {
  result <- calculate_statistics(c(1, 2, 3, 4, 5))
  expect_true(is.list(result))
  expect_named(result, c("mean", "median", "sd", "n"))
})

test_that("calculate_statistics computes correct values", {
  data <- c(1, 2, 3, 4, 5)
  result <- calculate_statistics(data)

  expect_equal(result$mean, 3)
  expect_equal(result$median, 3)
  expect_equal(result$n, 5)
})

test_that("calculate_statistics handles NA values", {
  data <- c(1, 2, NA, 4, 5)
  result <- calculate_statistics(data, na.rm = TRUE)

  expect_equal(result$n, 4)
  expect_equal(result$mean, 3)
})

test_that("validate_input catches type errors", {
  expect_error(
    validate_input("text", "numeric"),
    "Expected numeric"
  )
})

test_that("validate_input warns on empty input", {
  expect_warning(
    validate_input(numeric(0), "numeric"),
    "empty"
  )
})
