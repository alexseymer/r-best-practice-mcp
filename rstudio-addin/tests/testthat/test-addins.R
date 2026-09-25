context("RStudio Addins")

test_that("format_findings_for_display handles empty findings", {
  result <- format_findings_for_display(NULL)
  expect_is(result, "data.frame")
  expect_equal(nrow(result), 0)
  expect_equal(ncol(result), 6)
})

test_that("format_findings_for_display formats findings correctly", {
  findings <- list(
    list(
      id = "test-1",
      severity = "critical",
      category = "structure",
      message = "Test message",
      suggestions = c("suggestion 1", "suggestion 2"),
      file = "test.R",
      line = 42
    ),
    list(
      id = "test-2",
      severity = "important",
      category = "documentation",
      message = "Another message",
      suggestions = NULL,
      file = "another.R",
      line = 10
    )
  )

  result <- format_findings_for_display(findings)

  expect_equal(nrow(result), 2)
  expect_equal(result$Severity[1], "critical")
  expect_equal(result$Category[1], "structure")
  expect_equal(result$Message[1], "Test message")
  expect_equal(result$File[1], "test.R")
  expect_equal(result$Line[1], 42)
  expect_true(grepl("suggestion 1", result$Suggestions[1]))
  expect_equal(result$Suggestions[2], "")
})

test_that("NULL coalescing operator works correctly", {
  expect_equal(NULL %||% "default", "default")
  expect_equal("value" %||% "default", "value")
  expect_equal(0 %||% "default", 0)
  expect_equal(FALSE %||% "default", FALSE)
})

test_that("spinner_gif returns valid shiny HTML", {
  result <- spinner_gif()
  expect_is(result, "shiny.tag")
  expect_equal(result$name, "div")
})
