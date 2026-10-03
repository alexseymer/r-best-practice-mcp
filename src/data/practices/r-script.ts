import { Practice } from '../../types/practice.js';

export const rScriptPractices: Practice[] = [
  {
    id: 'rscript-header',
    title: 'Start scripts with a header comment',
    workflow: 'r-script',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description:
      'Begin each script with a comment block saying what it does (purpose, author, date)',
    details:
      'A short header comment tells readers what the script does, who wrote it and when, before they read any code. The check is deliberately minimal: it looks at the `.R` and `.r` files in the project root (subdirectories are not examined), in alphabetical order, and reports one finding for the first script whose first line (after an optional byte order mark) does not start with `#`. A shebang line or any comment passes; the purpose, author and date suggested in the advice are not verified. Keep the header to a few lines and update it when the purpose changes.',
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
      'Meaningful, lowercase file names sort predictably and work on case-sensitive and case-insensitive file systems; spaces and hyphens complicate shell use. The check inspects `.R` and `.r` files in the project root and in each first-level subdirectory (hidden directories and renv, node_modules, _book, _site, public and docs are skipped; at most 200 files are scanned) and reports names that do not match lowercase snake_case, such as MyScript.R, my-script.R or Analysis 1.R (`_targets.R` is exempt). Numeric prefixes like 01_clean.R are fine for ordering.',
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
      'Copy-pasted code drifts apart and hides mistakes, while a named function documents intent and can be tested once. This is a coarse heuristic that does not detect duplication. It runs on a single `.R` file (validate_file) and on the root `.R`/`.r` scripts during project validation (one finding, for the first script in alphabetical order), and reports a script of more than 50 lines that defines no function, that is, no `name <- function(`, `name = function(` or `name <- \\(x)` lambda assignment (comments and strings are ignored). Move repeated blocks into functions with explicit arguments and, as a rule of thumb, extract after copying code twice.',
    badExample: `# (the automated check fires once a file exceeds 50 lines with no function)
a <- read.csv("data/a.csv")
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
      'Labelled sections let readers skim a long script and let RStudio build a clickable outline. This is a heuristic check: it scans `.R` and `.r` files in the project root and one subdirectory level and reports the first one with more than 80 lines (blank lines included) and no section marker, meaning a comment that ends in `----`, `####` or `====`, or starts with `####` or `# ====`. It does not check that sections are sensibly named or spaced. Use one section per stage, for example load, clean, model and export.',
    badExample: `library(dplyr)
raw <- read.csv("data/sales.csv")
raw$date <- as.Date(raw$date)
clean <- filter(raw, !is.na(total))
fit <- lm(total ~ region, data = clean)
write.csv(clean, "output/clean.csv")
# ... imagine 80+ lines like this with no section headers`,
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
    title: 'Wrap script logic in functions instead of piling up globals',
    workflow: 'r-script',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description:
      'Avoid long runs of top-level assignments; use functions with parameters and a main() entry point',
    details:
      'Functions that read global variables are hard to test, and scripts that are one long list of top-level assignments break when run out of order. This is a heuristic nudge, not a scope analysis: it looks at the `.R` files in the project root and reports one finding for the first script with more than 15 top-level assignments, meaning lines that start at column 0 with `name <- value` or `name = value` where the value is not a function (comment lines are ignored, indented lines are not counted). It cannot tell whether a function actually reads a global. Pass inputs as arguments, return results, put the steps in functions called from a main() entry point, and keep configuration in one clearly named object at the top of the script.',
    badExample: `# Flagged once a script has more than 15 top-level assignments like these
threshold <- 10
scale_it <- function(x) {
  x / threshold   # silently depends on a global
}
raw <- read.csv("data/raw.csv")
clean <- raw[raw$value > threshold, ]
result <- scale_it(25)
# ... and a dozen more top-level steps`,
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
      'Unhandled errors stop a script halfway and leave partial output behind, whereas tryCatch lets you log a clear message and clean up. This is a heuristic check: it scans `.R` and `.r` files in the project root and one subdirectory level and reports the first file of more than 60 lines in which no line (other than full-line comments) contains tryCatch(, try(, stopifnot(, stop( or withCallingHandlers(. Other styles such as rlang::abort() or cli::cli_abort() are not recognised, and it cannot tell whether the risky steps are the ones wrapped. Wrap fragile steps (file reads, downloads, database calls) and validate inputs early.',
    badExample: `# (flagged once the script exceeds 60 lines without any error handling)
df <- read.csv("data/input.csv")
scores <- jsonlite::fromJSON(readLines("https://example.com/api/scores.json"))
df$score <- scores$score
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
      'Open database connections, file connections, sinks and graphics devices leak resources and can leave files unreadable if never released. This is a heuristic check: it scans `.R` and `.r` files in the project root and one subdirectory level, ignores comments and string contents, and reports a file that calls dbConnect(, assigns a file( or url( connection (file("stdin") is exempt), calls sink() with a target, or opens a pdf/png/jpeg/svg device when no matching dbDisconnect(, close(, sink() or dev.off( call appears anywhere in the same file. It does not pair each opener with its own release, and it cannot see cleanup done in another file. Release resources with on.exit() or withr::defer() so cleanup also happens after errors.',
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
