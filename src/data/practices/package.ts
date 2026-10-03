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
      "Keeping documentation next to the code means it is updated together with the function, and roxygen2 generates the man/*.Rd files and NAMESPACE entries for you. Describe every parameter, the return value and at least one example. The automated check only reports a package in which none of the .R files directly under R/ (subdirectories are not searched) contains a roxygen comment line, i.e. a line starting with #' (leading whitespace allowed). One such line anywhere is enough to pass, and it stays silent when R/ has no .R files or a file cannot be read; it does not judge how complete the documentation is.",
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
    description: 'Keep Package, Version, Title, Description, Authors@R and License current',
    details:
      'DESCRIPTION holds the metadata that R, CRAN and users rely on: name, version, title, authors, license and dependencies. Keep the Title in title case without a trailing period, write a full-sentence Description, and declare every package you use under Imports or Suggests. The automated check reports a missing DESCRIPTION file, and any of the fields Package, Version, Title, Description and License that is absent. It also requires either Authors@R or both Author and Maintainer. Field names are matched at the start of a line (a word inside another field does not count); the values are not validated.',
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
      'Automated tests let you change code with confidence and catch regressions before users do. Use testthat with the third edition, keep one test file per source file in tests/testthat/, and cover both normal behavior and edge cases. The automated check only verifies that a tests/ directory exists next to DESCRIPTION; it does not look for tests/testthat/, run the tests or measure how thorough they are.',
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
      "NAMESPACE decides which functions your package exports and which functions it imports from other packages. Do not edit it by hand: add #' @export and #' @importFrom tags in roxygen comments and let devtools::document() regenerate the file. The automated check only reports a project that has a DESCRIPTION file but no NAMESPACE file; it does not compare the exports against your code or detect a hand-edited file.",
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
      'https://roxygen2.r-lib.org/articles/namespace.html',
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
      'Function reference pages explain single functions, while a vignette shows how they work together to solve a real problem. Create one with usethis::use_vignette(), which also adds knitr and rmarkdown to Suggests and sets VignetteBuilder: knitr in DESCRIPTION (required for the vignette to be built). The automated check is a heuristic: it fires when there is no vignettes/ directory and R/ holds at least three .R files directly in R/ (subdirectories are not counted), which is used as a proxy for a package complex enough to need a guide. It does not check the vignette content or DESCRIPTION.',
    badExample: `mypkg/
  DESCRIPTION
  R/
    import.R
    clean.R
    summarise.R
    plot.R
  # no vignettes/ directory`,
    goodExample: `# In the console (also sets VignetteBuilder and Suggests)
usethis::use_vignette("getting-started")

# DESCRIPTION (added by use_vignette())
Suggests: knitr, rmarkdown
VignetteBuilder: knitr

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
    title: 'Declare a license and ship the LICENSE file it needs',
    workflow: 'package',
    category: 'structure',
    severity: 'critical',
    enforcement: 'automated',
    description:
      'Set the License field in DESCRIPTION, with a LICENSE file when it says file LICENSE',
    details:
      'Without a license nobody else may legally use or modify your code. Pick a license with usethis (for example usethis::use_mit_license()), which fills in the License field of DESCRIPTION and creates the LICENSE file. Licenses such as MIT and BSD need a short template file, so DESCRIPTION says License: MIT + file LICENSE; well-known licenses such as GPL-3 or Apache License (>= 2) are written by name and need no LICENSE file. The automated check reports a DESCRIPTION without a License field, and a License field that says file LICENSE (or file LICENCE) when none of LICENSE, LICENSE.md, LICENCE or LICENCE.md exists in the package root. It does not validate the license name or the file contents.',
    badExample: `Package: mypkg
Version: 0.1.0
License: file LICENSE
# but no LICENSE file in the repository`,
    goodExample: `# In the console
usethis::use_mit_license("Ada Lovelace")

# DESCRIPTION
License: MIT + file LICENSE

# LICENSE (the file the License field points to)
YEAR: 2026
COPYRIGHT HOLDER: Ada Lovelace

# Licenses written by name need no LICENSE file, e.g.
# License: GPL (>= 3)`,
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
      'R only loads and installs code from the R/ directory, so scripts placed elsewhere are not part of the package. Put functions in R/ with one file per topic, and keep exploratory scripts in a separate folder that is excluded with .Rbuildignore. The automated check only verifies that the R/ directory exists next to DESCRIPTION (it runs only once DESCRIPTION is present); it does not inspect the files inside.',
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
