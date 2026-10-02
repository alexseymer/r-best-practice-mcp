import { Practice } from '../../types/practice.js';

export const packagePractices: Practice[] = [
  {
    id: 'pkg-roxygen',
    title: 'Use roxygen2 for documentation',
    workflow: 'package',
    category: 'documentation',
    severity: 'important',
    enforcement: 'automated',
    description: "Document functions with #' @param, #' @return, #' @export",
    details:
      "Keeping documentation next to the code means it is updated together with the function, and roxygen2 generates the man/*.Rd files and NAMESPACE entries for you. Describe every parameter, the return value and at least one example. The automated check only looks for the absence of any roxygen comment line (a line starting with #') in the .R files directly under R/; it does not judge how complete the documentation is.",
    badExample: `# R/stats.R
# Computes the standard error
se <- function(x, na.rm = FALSE) {
  if (na.rm) x <- x[!is.na(x)]
  stats::sd(x) / sqrt(length(x))
}`,
    goodExample: `# R/stats.R
#' Standard error of the mean
#'
#' @param x A numeric vector.
#' @param na.rm Should missing values be removed first?
#' @return A single number.
#' @export
#' @examples
#' se(c(1, 2, 3, 4))
se <- function(x, na.rm = FALSE) {
  if (na.rm) x <- x[!is.na(x)]
  stats::sd(x) / sqrt(length(x))
}`,
    tags: ['roxygen', 'documentation'],
    references: [
      'https://r-pkgs.org/man.html',
      'https://roxygen2.r-lib.org/articles/roxygen2.html',
    ],
  },
  {
    id: 'pkg-description',
    title: 'Maintain accurate DESCRIPTION file',
    workflow: 'package',
    category: 'structure',
    severity: 'critical',
    enforcement: 'automated',
    description: 'Keep Package, Version, Title, Description, Authors, License current',
    details:
      'DESCRIPTION holds the metadata that R, CRAN and users rely on: name, version, title, authors, license and dependencies. Keep the Title in title case without a trailing period, write a full-sentence Description, and declare every package you use under Imports or Suggests. The automated check reports a missing DESCRIPTION file and any of the fields Package, Version, Title, Author, Maintainer and License that do not appear in it; it does not validate their values.',
    badExample: `Package: mypkg
Version: 1.0
Title: a package that does stuff.
License: whatever`,
    goodExample: `Package: mypkg
Version: 0.1.0
Title: Summarise Survey Responses
Description: Provides helpers to clean and summarise survey data.
Authors@R: person("Ada", "Lovelace", email = "ada@example.com",
    role = c("aut", "cre"))
License: MIT + file LICENSE
Imports: dplyr
Suggests: testthat (>= 3.0.0)
Config/testthat/edition: 3
Encoding: UTF-8`,
    tags: ['description', 'metadata'],
    references: ['https://r-pkgs.org/description.html'],
  },
  {
    id: 'pkg-tests',
    title: 'Include comprehensive tests',
    workflow: 'package',
    category: 'testing',
    severity: 'important',
    enforcement: 'automated',
    description: 'Use testthat package in tests/testthat/ directory',
    details:
      'Automated tests let you change code with confidence and catch regressions before users do. Use testthat with the third edition, keep one test file per source file in tests/testthat/, and cover both normal behavior and edge cases. The automated check only verifies that a tests/ directory exists; it does not run the tests or measure how thorough they are.',
    badExample: `mypkg/
  DESCRIPTION
  NAMESPACE
  R/
    stats.R
# no tests/ directory`,
    goodExample: `# Created with usethis::use_testthat(3)
# tests/testthat/test-stats.R
test_that("se() ignores missing values when asked", {
  expect_equal(se(c(1, 2, NA), na.rm = TRUE), se(c(1, 2)))
})

test_that("se() propagates NA by default", {
  expect_true(is.na(se(c(1, 2, NA))))
})`,
    tags: ['testing', 'testthat'],
    references: [
      'https://r-pkgs.org/testing-basics.html',
      'https://r-pkgs.org/testing-design.html',
    ],
  },
  {
    id: 'pkg-namespace',
    title: 'Use NAMESPACE correctly',
    workflow: 'package',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Export public functions and import dependencies properly',
    details:
      "NAMESPACE decides which functions your package exports and which functions it imports from other packages. Do not edit it by hand: add #' @export and #' @importFrom tags in roxygen comments and let devtools::document() regenerate the file. The automated check only reports a project that has a DESCRIPTION file but no NAMESPACE file; it does not compare the exports against your code.",
    badExample: `# NAMESPACE edited by hand and out of date
export(se)
import(dplyr)
# helper() was added later but never exported or documented`,
    goodExample: `# R/stats.R
#' @importFrom stats sd
#' @export
se <- function(x) sd(x) / sqrt(length(x))

# Then regenerate NAMESPACE in the console:
# devtools::document()

# NAMESPACE (generated, do not edit)
export(se)
importFrom(stats,sd)`,
    tags: ['namespace', 'exports'],
    references: [
      'https://r-pkgs.org/dependencies-mindset-background.html',
      'https://r-pkgs.org/dependencies-in-practice.html',
    ],
  },
  {
    id: 'pkg-vignettes',
    title: 'Include vignettes for complex features',
    workflow: 'package',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Add vignettes/ directory with usage examples',
    details:
      'Function reference pages explain single functions, while a vignette shows how they work together to solve a real problem. Create one with usethis::use_vignette() and list knitr and rmarkdown in Suggests. The automated check is a heuristic: it fires when there is no vignettes/ directory and R/ holds at least three .R files, which is used as a proxy for a package complex enough to need a guide.',
    badExample: `mypkg/
  DESCRIPTION
  R/
    import.R
    clean.R
    summarise.R
    plot.R
  # no vignettes/ directory`,
    goodExample: `# In the console
usethis::use_vignette("getting-started")

# vignettes/getting-started.Rmd
---
title: "Getting started with mypkg"
output: rmarkdown::html_vignette
vignette: >
  %\\VignetteIndexEntry{Getting started with mypkg}
  %\\VignetteEngine{knitr::rmarkdown}
  %\\VignetteEncoding{UTF-8}
---`,
    tags: ['vignettes', 'documentation'],
    references: ['https://r-pkgs.org/vignettes.html'],
  },
  {
    id: 'pkg-readme',
    title: 'Create comprehensive README',
    workflow: 'package',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Include installation, basic usage, and example',
    details:
      'The README is the first thing people see on GitHub and CRAN, so it should say what the package does, how to install it and show a short working example. Write it as README.Rmd and knit it with devtools::build_readme() so the example output stays correct. The automated check only verifies that README.md or README.Rmd exists in the project root; it does not read the content.',
    badExample: `mypkg/
  DESCRIPTION
  R/
  # no README.md or README.Rmd`,
    goodExample: `# mypkg

Summarise survey responses in a few lines of code.

## Installation

\`\`\`r
# install.packages("pak")
pak::pak("ada/mypkg")
\`\`\`

## Example

\`\`\`r
library(mypkg)
se(c(1, 2, 3, 4))
\`\`\``,
    tags: ['readme', 'documentation'],
    references: ['https://r-pkgs.org/other-markdown.html'],
  },
  {
    id: 'pkg-license',
    title: 'Include LICENSE file',
    workflow: 'package',
    category: 'structure',
    severity: 'critical',
    enforcement: 'automated',
    description: 'Specify license (MIT, GPL, Apache, etc.) in LICENSE file',
    details:
      'Without a license nobody else may legally use or modify your code. Pick a license with usethis (for example usethis::use_mit_license()), which fills in the License field of DESCRIPTION and creates the LICENSE file. The automated check only verifies that a file named LICENSE exists in the package root; it does not validate its contents.',
    badExample: `Package: mypkg
Version: 0.1.0
License: file LICENSE
# but no LICENSE file in the repository`,
    goodExample: `# In the console
usethis::use_mit_license("Ada Lovelace")

# DESCRIPTION
License: MIT + file LICENSE

# LICENSE
YEAR: 2026
COPYRIGHT HOLDER: Ada Lovelace`,
    tags: ['license', 'legal'],
    references: ['https://r-pkgs.org/license.html'],
  },
  {
    id: 'pkg-check',
    title: 'Pass devtools::check() without errors',
    workflow: 'package',
    category: 'testing',
    severity: 'important',
    enforcement: 'guidance',
    description: 'Resolve all check() errors, warnings, and notes',
    details:
      'devtools::check() runs R CMD check, which catches undocumented arguments, missing dependencies, broken examples and many other problems. Run it often during development and automatically in continuous integration, and fix every error, warning and note before release. This is guidance only; the validator never runs R code, so it cannot verify the result of a check.',
    badExample: `# Only load the code and hope for the best
devtools::load_all()
# warnings and notes pile up unnoticed:
# W  checking for missing documentation entries
# N  checking R code for possible problems`,
    goodExample: `# Run the full check locally
devtools::check()

# Run it on every push (GitHub Actions)
usethis::use_github_action("check-standard")

# Goal:
# 0 errors | 0 warnings | 0 notes`,
    tags: ['check', 'quality'],
    references: ['https://r-pkgs.org/R-CMD-check.html'],
  },
  {
    id: 'pkg-coverage',
    title: 'Aim for test coverage > 80%',
    workflow: 'package',
    category: 'testing',
    severity: 'recommended',
    enforcement: 'guidance',
    description: 'Use covr package to measure and improve test coverage',
    details:
      'Coverage shows which lines of your package are never executed by the tests, pointing at untested behavior. Measure it with the covr package, inspect the report for important gaps, and treat a threshold such as 80% as a guide rather than a goal in itself. This is guidance only; the validator does not run tests and cannot compute coverage.',
    badExample: `# Tests exist but nobody knows what they cover
devtools::test()
# no coverage measured, large untested branches go unnoticed`,
    goodExample: `# Measure coverage locally
cov <- covr::package_coverage()
covr::percent_coverage(cov)

# Browse the untested lines
covr::report(cov)

# Track it in CI
usethis::use_coverage()`,
    tags: ['testing', 'coverage'],
    references: ['https://covr.r-lib.org/', 'https://r-pkgs.org/testing-design.html'],
  },
  {
    id: 'pkg-structure',
    title: 'Keep package source code in an R/ directory',
    workflow: 'package',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'An R package keeps its source files in the R/ directory next to DESCRIPTION',
    details:
      'R only loads and installs code from the R/ directory, so scripts placed elsewhere are not part of the package. Put functions in R/ with one file per topic, and keep exploratory scripts in a separate folder that is excluded with .Rbuildignore. The automated check only verifies that the R/ directory exists next to DESCRIPTION.',
    badExample: `mypkg/
  DESCRIPTION
  NAMESPACE
  functions.R
  utils.R`,
    goodExample: `mypkg/
  DESCRIPTION
  NAMESPACE
  R/
    stats.R
    utils.R
  man/
  tests/
    testthat/`,
    tags: ['package', 'structure'],
    references: ['https://r-pkgs.org/structure.html'],
  },
];
