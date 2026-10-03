import { Practice } from '../../types/practice.js';

export const targetsPractices: Practice[] = [
  {
    id: 'targets-structure',
    title: 'Organize all targets in _targets.R',
    workflow: 'targets',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description:
      'Keep the pipeline entry point in _targets.R and have it return the list of targets',
    details:
      'The targets package reads the pipeline from _targets.R in the project root, so that file is the single entry point for tar_make() and tar_visnetwork(). The check is a heuristic: it reports when `_targets.R` is missing from the project root, or when the file does not contain the text `list(` anywhere (comments are not excluded). It does not parse the file, so a pipeline built with `tarchetypes::tar_plan()` or a target list assembled elsewhere can trigger a false positive. Keep the file short: load packages, source() helper functions from R/, and return the list of tar_target() objects.',
    badExample: `# analysis.R: not read by tar_make()
library(targets)
tar_target(raw_data, read.csv("data/raw.csv"))
tar_target(model, lm(y ~ x, data = raw_data))`,
    goodExample: `# _targets.R
library(targets)
tar_option_set(packages = c("dplyr"))
tar_source("R")

list(
  tar_target(raw_data, read.csv("data/raw.csv")),
  tar_target(model, fit_model(raw_data))
)`,
    tags: ['targets', 'pipeline'],
    references: [
      'https://books.ropensci.org/targets/walkthrough.html',
      'https://docs.ropensci.org/targets/',
    ],
  },
  {
    id: 'targets-naming',
    title: 'Use snake_case for target names',
    workflow: 'targets',
    category: 'naming',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Follow snake_case convention for all target names',
    details:
      'Target names are R symbols that appear in commands, in the stored _targets/objects and in tar_read(), so consistent lowercase names are easier to type and to track in the dependency graph. The check scans `_targets.R` and every .R or .r file under R/ (including subfolders) for `tar_target(name, ...)` and `tar_target(name = name, ...)` calls, also when the call spans several lines and when it is written `targets::tar_target(`. Comments and string contents are ignored. It reports names that are not lowercase snake_case (letters, digits and underscores, starting with a lowercase letter), so dots, capitals and leading underscores are flagged. Targets created by other functions (for example `tar_map()` or `tar_target_raw()`) and names given as strings are not examined. Rename the target and every command that references it.',
    badExample: `list(
  tar_target(rawData, read.csv("data/raw.csv")),
  tar_target(Clean.Data, clean(rawData)),
  tar_target(name = FitModel, command = fit(Clean.Data))
)`,
    goodExample: `list(
  tar_target(raw_data, read.csv("data/raw.csv")),
  tar_target(clean_data, clean(raw_data)),
  tar_target(name = fit_model, command = fit(clean_data))
)`,
    tags: ['targets', 'naming'],
    references: [
      'https://docs.ropensci.org/targets/reference/tar_target.html',
      'https://style.tidyverse.org/syntax.html',
    ],
  },
  {
    id: 'targets-dependencies',
    title: 'Make dependencies explicit',
    workflow: 'targets',
    category: 'structure',
    severity: 'important',
    enforcement: 'guidance',
    description: 'List all dependencies in target command',
    details:
      'targets finds dependencies by static code analysis of each command and of the functions it calls, so a target only reruns when something it visibly mentions changes. Reference upstream targets by name in the command, pass them to functions as arguments, and track input files by declaring them as targets with `format = "file"` and referring to that target, instead of reading a file by path inside a helper function (edits to such a file would go unnoticed). This is guidance only and is not checked automatically.',
    badExample: `summarize_data <- function() {
  # the file path is hidden inside the function body, so targets
  # cannot tell when data/raw.csv changes
  raw <- read.csv("data/raw.csv")
  summary(raw)
}

list(
  tar_target(summary_stats, summarize_data())
)`,
    goodExample: `summarize_data <- function(raw) {
  summary(raw)
}

list(
  tar_target(raw_file, "data/raw.csv", format = "file"),
  tar_target(raw_data, read.csv(raw_file)),
  tar_target(summary_stats, summarize_data(raw_data))
)`,
    tags: ['targets', 'dependencies'],
    references: [
      'https://books.ropensci.org/targets/walkthrough.html',
      'https://books.ropensci.org/targets/data.html',
    ],
  },
  {
    id: 'targets-branching',
    title: 'Use branching to iterate over many inputs',
    workflow: 'targets',
    category: 'performance',
    severity: 'recommended',
    enforcement: 'guidance',
    description:
      'Use dynamic branching with pattern = map() (or tarchetypes::tar_map() for static branching) to run one target over many inputs',
    details:
      'Branching lets one target definition run over many inputs, with each branch cached and runnable on its own worker. Use dynamic branching (pattern = map(...)) when the number of branches is only known at run time and static branching with tarchetypes::tar_map() when you can list the values up front. To run branches in parallel, register a `crew` controller with `tar_option_set(controller = ...)` and call `tar_make()`; the older `tar_make_future()` is superseded by crew. This is guidance only and is not checked automatically.',
    badExample: `list(
  tar_target(files, list.files("data", full.names = TRUE)),
  # one big target: any changed file reruns everything, no parallelism
  tar_target(results, lapply(files, process_file))
)`,
    goodExample: `# _targets.R
library(targets)
tar_option_set(controller = crew::crew_controller_local(workers = 2))

list(
  tar_target(files, list.files("data", full.names = TRUE)),
  tar_target(
    results,
    process_file(files),
    pattern = map(files)
  )
)`,
    tags: ['targets', 'parallel'],
    references: [
      'https://books.ropensci.org/targets/dynamic.html',
      'https://books.ropensci.org/targets/static.html',
      'https://docs.ropensci.org/tarchetypes/reference/tar_map.html',
      'https://books.ropensci.org/targets/crew.html',
    ],
  },
];
