# Changelog

## Unreleased

The server is now an MCP server only. The web interface, the REST API, the command-line tool and the editor add-ins
are removed. The last version with them is tagged `v0.8.5-legacy`.

### Changed (breaking)
- Three tools instead of six: `check_project` (detection and validation in one call), `get_practice` and
  `create_project`. `detect_workflow`, `validate_project`, `validate_file`, `list_practices` and `generate_template` are
  removed.
- `create_project` returns the file list for a standard project (package, shiny, quarto, rmarkdown, analysis). The client
  writes the files. Missing details are asked through MCP elicitation or listed for the assistant to ask.
- The package template's DESCRIPTION title is `Utility Functions` instead of a placeholder. It follows title case and does not repeat the package name.
- Heuristic checks (content-based, not a fact about the project) are at most `recommended` and say "Consider ...":
  `rscript-functions`, `rscript-errors`, `rscript-cleanup`, `rscript-globals`, `quarto-text`, `shiny-separation`,
  `shiny-validation`, `plumber-status`, `plumber-validation` and `plumber-error` were `important` or `critical`.
- `plumber-validation` no longer treats any `if (` as validation. A validation helper, `stopifnot()`, `req()`, or a guard such as `if (is.null(x)) stop(...)` counts; a plain `if` does not.
- `check_project` requires an absolute `path` (`INVALID_PARAMETER`) and reports a file given in place of a folder as
  `NOT_A_FOLDER`.
- `pkg-description` checks the content of Title (no trailing full stop, at most 65 characters, no "A package ..." start, title case by a word-list heuristic) and that Description ends with a full stop. These findings are recommended and say "Consider".
- `pkg-tests` looks for `tests/testthat/` (the R Packages layout), not just any `tests/` folder.
- `rscript-naming` accepts lowercase words joined by `_` or `-`, as the tidyverse style guide does (`data-cleaning.R` is
  no longer reported).

### Added
- Four guided prompts: `neues-r-paket`, `neue-shiny-app`, `neues-quarto-projekt` (with a `format` argument) and
  `neue-datenanalyse`.
- Practices as MCP resources: `practice://<id>` and an index at `practices://all`.
- Installation from GitHub: a `prepare` script builds the server on install, so `npm exec --package=github:…` works.

### Removed
- CLI (`r-practices`), REST API, dashboard, Docker Compose and nginx files, VS Code extension, RStudio add-in, analysis
  and module code, the community practice gate, the browser engine, and the project documents that described them.
- The example projects moved to `tests/fixtures/examples` (test data only).

