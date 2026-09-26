# Best Practices Deep Dive by Workflow

Comprehensive guide to the 52+ best practices organized by R workflow.

## R Scripts (7 Practices)

### 1. File Headers
**Why:** Provides essential metadata and project context at a glance.

**Best Practice:**
```r
#' Script Purpose
#'
#' Author: Your Name
#' Date: 2026-09-26
#' Description: What this script does
#' ==================================================
```

**Impact:** Makes scripts self-documenting and easier for others to understand.

### 2. Use Functions
**Why:** Avoids global variable pollution and increases code reusability.

**Anti-pattern:**
```r
data <- read.csv(\"data.csv\")
filtered <- filter(data, value > 100)
mean_val <- mean(filtered$value)
print(mean_val)
```

**Best Practice:**
```r
calculate_mean_for_threshold <- function(data, threshold = 100) {
  data %>%
    filter(value > threshold) %>%
    pull(value) %>%
    mean()
}
```

### 3. Meaningful Names
**Why:** Code is read much more than written. Good names = self-documenting code.

**Anti-pattern:**
```r
x <- df$a
y <- df$b
z <- x * y
```

**Best Practice:**
```r
revenue <- sales_data$price
quantity <- sales_data$units_sold
total_sales <- revenue * quantity
```

### 4. Comments for Non-Obvious Logic
**Why:** Explains the \"why\" not the \"what\" (code shows what, comments explain why).

**Good Comment:**
```r
# Bootstrap confidence interval because distribution is non-normal
ci <- boot::boot.ci(fit, type = \"bca\")
```

**Not Needed:**
```r
# Add 1 to counter (obvious from code)
counter <- counter + 1
```

### 5. Remove Unused Variables
**Why:** Reduces cognitive load and prevents confusion about what's actually used.

**Not Clean:**
```r
result <- expensive_calculation()
intermediate <- transform(result)  # Never used again
final <- intermediate + 1
```

### 6. Use Relative Paths
**Why:** Makes code portable across different machines and platforms.

**Avoid:**
```r
data <- read.csv(\"/Users/john/projects/analysis/data.csv\")
```

**Better:**
```r
data <- read.csv(\"data/raw/input.csv\")  # Relative to project root
```

### 7. Consistent Style
**Why:** Reduces cognitive friction when reading code; signals professionalism.

**Inconsistent:**
```r
my_function<-function(x){
  y=x^2
  return(y)
}
```

**Consistent (tidyverse style):**
```r
my_function <- function(x) {
  x^2
}
```

---

## R Packages (9 Practices)

### 1. Use roxygen2 for Documentation
Automates NAMESPACE management and generates help files from comments.

```r
#' Calculate Mean
#'
#' Computes the arithmetic mean of numeric input.
#'
#' @param x A numeric vector
#' @param na.rm Logical; remove NA values?
#'
#' @return The mean value
#'
#' @examples
#' calculate_mean(c(1, 2, 3, 4, 5))
#'
#' @export
calculate_mean <- function(x, na.rm = TRUE) {
  mean(x, na.rm = na.rm)
}
```

### 2. Complete DESCRIPTION File
```r
Package: mypackage
Title: Descriptive Title
Version: 0.1.0
Authors@R: person(\"First\", \"Last\", email = \"first@last.com\", role = c(\"aut\", \"cre\"))
Description: Longer description of what the package does.
License: MIT
Imports:
    dplyr (>= 1.0),
    ggplot2 (>= 3.0)
Suggests:
    testthat (>= 3.0)
```

### 3. Include LICENSE
```bash
# Generate MIT license
usethis::use_mit_license(\"Your Name\")
```

### 4. Add README.md
- Package overview
- Installation instructions
- Quick example
- Links to documentation

### 5. Create Tests with testthat
```r
context(\"Statistics\")

test_that(\"mean calculation works\", {
  result <- calculate_mean(c(1, 2, 3))
  expect_equal(result, 2)
})
```

### 6. Run R CMD check
```r
# Before release
devtools::check()
```

### 7-9. Other Practices
- Appropriate naming conventions
- Semantic versioning (0.1.0, not 0.1)
- Manage dependencies properly

---

## Shiny Applications (7 Practices)

### 1. Validate All Inputs
```r
observeEvent(input$calculate, {
  if (is.na(input$value) || input$value < 0) {
    showNotification(\"Value must be non-negative\", type = \"error\")
    return()
  }
  # Process
})
```

### 2. Provide User Feedback
```r
output$status <- renderText({
  if (is.null(reactive_data())) {
    \"Loading data...\"
  } else {
    paste(\"Loaded\", nrow(reactive_data()), \"rows\")
  }
})
```

### 3. Use Reactive Programming Correctly
```r
# Good: Reactive dependency
reactive_result <- reactive({
  data %>%
    filter(value > input$threshold)
})

# Use it
output$plot <- renderPlot({
  plot(reactive_result())
})
```

### 4-7. Other Practices
- Use modules for complex apps
- Error handling with tryCatch
- Code organization with comments
- Module testing

---

## Data Analysis Projects (3 Practices)

### 1. Standard Directory Structure
```
project/
├── data/
│   ├── raw/           # Original, immutable data
│   └── processed/     # Cleaned data
├── R/
│   ├── 01_load.R
│   ├── 02_clean.R
│   └── 03_analyze.R
├── output/
│   ├── figures/
│   └── tables/
├── README.md
└── .gitignore
```

### 2. Document Data Sources
```r
# data_dictionary.md
# Variable: price
# Source: from sales database
# Type: numeric (USD)
# Range: 0.99 - 9999.99
# Missing values: None
```

### 3. Clear README with Setup
```markdown
# Project Name

## Objective
What are we trying to answer?

## Data
Where does data come from? How to refresh?

## Setup
```bash
# Step by step instructions
```

## Running Analysis
```bash
Rscript R/01_load.R
Rscript R/02_clean.R
Rscript R/03_analyze.R
```
```

---

## Quarto Documents (7 Practices)

### 1. Include YAML Front Matter
```yaml
---
title: \"Analysis Report\"
author: \"Jane Doe\"
date: today
format: html
toc: true
code-fold: true
cache: true
---
```

### 2. Use Code Chunk Labels
```{r}
#| label: data-load
#| message: false

data <- read.csv(\"data.csv\")
```

### 3. Enable Cache for Expensive Operations
```{r}
#| label: analysis
#| cache: true

fit <- lm(y ~ x, data = data)
```

### 4-7. Other Practices
- Add figure captions
- Add table captions
- Configure chunk options
- Validate output

---

## Common Themes Across All Workflows

### 1. Documentation
- Comment your code
- Write README files
- Use function documentation
- Include examples

### 2. Error Handling
- Validate inputs
- Provide meaningful error messages
- Use try/tryCatch appropriately

### 3. Organization
- Logical directory structure
- Consistent naming
- Modular code

### 4. Testing
- Write tests
- Test edge cases
- Automate testing

### 5. Quality
- Follow style guides
- Use linters
- Peer review

---

## Workflow-Specific Recommendations

| Workflow | Priority 1 | Priority 2 | Priority 3 |
|----------|-----------|-----------|-----------|
| r-script | Headers | Functions | Naming |
| package | roxygen2 | Tests | DESCRIPTION |
| shiny | Input validation | Reactivity | Modules |
| analysis | Directory structure | Documentation | README |
| quarto | YAML metadata | Chunk labels | Caching |

---

## Resources

- [Tidyverse Style Guide](https://style.tidyverse.org/)
- [R Packages Book](https://r-pkgs.org/)
- [Shiny Best Practices](https://shiny.rstudio.com/articles/)
- [Quarto Documentation](https://quarto.org/docs/guide/)

## Next Steps

1. Choose your primary workflow
2. Review the 4-7 practices for that workflow
3. Audit your current projects against these
4. Make improvements iteratively
5. Use r-practices to validate progress
