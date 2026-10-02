import { Practice } from '../../types/practice.js';

export const targetsPractices: Practice[] = [
  {
    id: 'targets-structure',
    title: 'Organize all targets in _targets.R',
    workflow: 'targets',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Keep all target definitions in _targets.R',
    details:
      'The targets package reads the pipeline from _targets.R in the project root, so that file is the single entry point for tar_make() and tar_visnetwork(). The check reports when _targets.R is missing, or when it does not contain a list( call that defines the targets. Keep the file short: load packages, source() helper functions from R/, and return the list of tar_target() objects.',
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
      'Target names are R symbols that appear in commands, in the stored _targets/objects and in tar_read(), so consistent lowercase names are easier to type and to track in the dependency graph. The check scans _targets.R and R/*.R for tar_target(name, ...) and tar_target(name = name, ...) calls and reports names that are not lowercase snake_case (letters, digits and underscores, starting with a letter). Rename the target and every command that references it.',
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
      'targets finds dependencies by static code analysis of each command, so a target only reruns when something it visibly mentions changes. Reference upstream targets directly by name in the command, pass them as function arguments, and track input files with format = "file" instead of reading them inside helper functions. This is guidance only and is not checked automatically.',
    badExample: `list(
  tar_target(raw_data, read.csv("data/raw.csv")),
  # summarize() reads the global raw_data hidden inside its body,
  # so targets cannot see the dependency
  tar_target(summary_stats, summarize_hidden())
)`,
    goodExample: `list(
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
    title: 'Use branching for parallel computation',
    workflow: 'targets',
    category: 'performance',
    severity: 'recommended',
    enforcement: 'guidance',
    description: 'Apply targets::tar_map() for data parallelism',
    details:
      'Branching lets one target definition run over many inputs, with each branch cached and runnable on its own worker. Use dynamic branching (pattern = map(...)) when the number of branches is only known at run time and static branching with tarchetypes::tar_map() when you can list the values up front. Pair it with tar_make_future() or crew controllers to run branches in parallel. This is guidance only and is not checked automatically.',
    badExample: `list(
  tar_target(files, list.files("data", full.names = TRUE)),
  # one big target: any changed file reruns everything, no parallelism
  tar_target(results, lapply(files, process_file))
)`,
    goodExample: `list(
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
    ],
  },
];
