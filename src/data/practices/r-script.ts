import { Practice } from '../../types/practice.js';

export const rScriptPractices: Practice[] = [
  {
    id: 'rscript-header',
    title: 'Include header comment with metadata',
    workflow: 'r-script',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Script should start with header including purpose, author, date',
    details:
      'A short header comment tells readers what the script does, who wrote it and when, before they read any code. The check looks at the first .R file in the project root (not subdirectories) and reports when its first line is not a comment. Keep the header to a few lines and update it when the purpose changes.',
    badExample: `library(dplyr)
data <- read.csv("data/sales.csv")
summary(data)`,
    goodExample: `# Purpose: Summarise monthly sales by region
# Author:  Jane Doe
# Date:    2024-03-01

library(dplyr)
sales <- read.csv("data/sales.csv")
summary(sales)`,
    tags: ['header', 'documentation'],
    references: [
      'https://style.tidyverse.org/files.html',
      'https://r4ds.hadley.nz/workflow-scripts.html',
    ],
  },
  {
    id: 'rscript-naming',
    title: 'Use snake_case for script filenames',
    workflow: 'r-script',
    category: 'naming',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Script filenames should use snake_case (e.g., data_cleaning.R)',
    details:
      'Meaningful, lowercase file names sort predictably and work on case-sensitive and case-insensitive file systems; spaces and hyphens complicate shell use. The check inspects .R files in the project root and one level of subdirectories and reports names that do not match lowercase snake_case, such as MyScript.R, my-script.R or Analysis 1.R (_targets.R is exempt). Numeric prefixes like 01_clean.R are fine for ordering.',
    badExample: `MyScript.R
my-script.R
Analysis 1.R
cleanData.R`,
    goodExample: `my_script.R
data_cleaning.R
01_import_data.R
02_fit_models.R`,
    tags: ['naming', 'convention'],
    references: [
      'https://style.tidyverse.org/files.html',
      'https://r4ds.hadley.nz/workflow-scripts.html',
    ],
  },
  {
    id: 'rscript-functions',
    title: 'Extract reusable logic into functions',
    workflow: 'r-script',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Avoid code duplication; extract repeated logic into functions',
    details:
      'Copy-pasted code drifts apart and hides mistakes, while a named function documents intent and can be tested once. The check is a heuristic applied when a single .R file is validated: it reports a script of more than 50 lines that defines no top-level function (name <- function). Move repeated blocks into functions with explicit arguments and, as a rule of thumb, extract after copying code twice.',
    badExample: `a <- read.csv("data/a.csv")
a$total <- a$price * a$qty
a <- a[a$total > 0, ]

b <- read.csv("data/b.csv")
b$total <- b$price * b$qty
b <- b[b$total > 0, ]`,
    goodExample: `load_orders <- function(path) {
  orders <- read.csv(path)
  orders$total <- orders$price * orders$qty
  orders[orders$total > 0, ]
}

a <- load_orders("data/a.csv")
b <- load_orders("data/b.csv")`,
    tags: ['function', 'refactor'],
    references: ['https://r4ds.hadley.nz/functions.html', 'https://adv-r.hadley.nz/functions.html'],
  },
  {
    id: 'rscript-sections',
    title: 'Organize script with clear sections',
    workflow: 'r-script',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Use comment headers to divide script into logical sections',
    details:
      'Labelled sections let readers skim a long script and let RStudio build a clickable outline. This is a heuristic check: it reports the first .R file (root or one subdirectory level) with more than 80 lines and no section marker such as "# Title ----", a row of #### or a row of ====. Use one section per stage, for example load, clean, model and export.',
    badExample: `library(dplyr)
raw <- read.csv("data/sales.csv")
raw$date <- as.Date(raw$date)
clean <- filter(raw, !is.na(total))
fit <- lm(total ~ region, data = clean)
write.csv(clean, "output/clean.csv")
# ... 80+ more lines with no structure`,
    goodExample: `# Load data ----------------------------------------------------
library(dplyr)
raw <- read.csv("data/sales.csv")

# Clean data ----------------------------------------------------
clean <- filter(raw, !is.na(total))

# Model ---------------------------------------------------------
fit <- lm(total ~ region, data = clean)

# Export --------------------------------------------------------
write.csv(clean, "output/clean.csv")`,
    tags: ['organization', 'readability'],
    references: [
      'https://style.tidyverse.org/files.html',
      'https://r4ds.hadley.nz/workflow-style.html',
    ],
  },
  {
    id: 'rscript-globals',
    title: 'Minimize global variables',
    workflow: 'r-script',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Avoid relying on global state; use function parameters instead',
    details:
      'Functions that read global variables are hard to test and break when run in a different order. The check looks at the first .R file in the project root and reports each top-level line of the form name <- value (other than function definitions). Pass inputs as arguments, return results, and keep configuration in one clearly named object at the top of the script.',
    badExample: `threshold <- 10
scale_it <- function(x) {
  x / threshold   # silently depends on a global
}
result <- scale_it(25)`,
    goodExample: `scale_it <- function(x, threshold = 10) {
  x / threshold
}

main <- function() {
  scale_it(25, threshold = 10)
}
main()`,
    tags: ['scope', 'best-practice'],
    references: ['https://adv-r.hadley.nz/functions.html', 'https://r4ds.hadley.nz/functions.html'],
  },
  {
    id: 'rscript-errors',
    title: 'Handle errors gracefully with tryCatch',
    workflow: 'r-script',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Use tryCatch for error handling in production scripts',
    details:
      'Unhandled errors stop a script halfway and leave partial output behind, whereas tryCatch lets you log a clear message and clean up. This is a heuristic check: it reports the first .R file of more than 60 lines in which no uncommented tryCatch(, try(, stopifnot(, stop( or withCallingHandlers( call appears. Wrap fragile steps (file reads, downloads, database calls) and validate inputs early.',
    badExample: `df <- read.csv("data/input.csv")
resp <- httr::GET("https://example.com/api")
df$score <- jsonlite::fromJSON(rawToChar(resp$content))$score
write.csv(df, "output/scored.csv")`,
    goodExample: `df <- tryCatch(
  read.csv("data/input.csv"),
  error = function(e) {
    stop("Could not read input.csv: ", conditionMessage(e), call. = FALSE)
  }
)
stopifnot(nrow(df) > 0, "id" %in% names(df))
write.csv(df, "output/scored.csv")`,
    tags: ['error-handling', 'robustness'],
    references: [
      'https://adv-r.hadley.nz/conditions.html',
      'https://style.tidyverse.org/syntax.html',
    ],
  },
  {
    id: 'rscript-cleanup',
    title: 'Clean up connections and files',
    workflow: 'r-script',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Close database connections and file handles at script end',
    details:
      'Open database connections, file connections, sinks and graphics devices leak resources and can leave files unreadable if never released. This is a heuristic check: for each script it ignores comment lines and reports a dbConnect(, an assigned file( or url( connection, sink(file) or a pdf/png/jpeg/svg device when the matching dbDisconnect(, close(, sink() or dev.off( call is absent from the same file. Release resources with on.exit() or withr::defer() so cleanup also happens after errors.',
    badExample: `con <- DBI::dbConnect(RSQLite::SQLite(), "data/app.sqlite")
orders <- DBI::dbGetQuery(con, "SELECT * FROM orders")
png("output/orders.png")
plot(orders$total)`,
    goodExample: `con <- DBI::dbConnect(RSQLite::SQLite(), "data/app.sqlite")
orders <- DBI::dbGetQuery(con, "SELECT * FROM orders")
DBI::dbDisconnect(con)

png("output/orders.png")
plot(orders$total)
dev.off()`,
    tags: ['resource-management', 'cleanup'],
    references: [
      'https://dbi.r-dbi.org/reference/dbDisconnect.html',
      'https://withr.r-lib.org/reference/defer.html',
    ],
  },
];
