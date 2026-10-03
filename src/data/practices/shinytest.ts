import { Practice } from '../../types/practice.js';

export const shinytestPractices: Practice[] = [
  {
    id: 'shinytest-structure',
    title: 'Keep app tests in tests/testthat/ (or legacy tests/shinytest/)',
    workflow: 'shinytest',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description:
      'Put shinytest2 tests in tests/testthat/; the legacy tests/shinytest/ layout is also accepted',
    details:
      'Keeping app tests in a predictable place lets tools and teammates find, run and review them. shinytest2 runs app tests through testthat, so they live in tests/testthat/ (for example test-shinytest2.R, with expected values in tests/testthat/_snaps/); shinytest2::use_shinytest2() sets this up. The legacy shinytest package stored recordings in tests/shinytest/, and that directory is still accepted. The automated check passes when tests/testthat/ or tests/shinytest/ exists and reports a project that has neither; it does not look at the files inside.',
    badExample: `myapp/
  app.R
  test_app_1.R
  recording.R`,
    goodExample: `# Created with shinytest2::use_shinytest2()
myapp/
  app.R
  tests/
    testthat.R
    testthat/
      setup-shinytest2.R
      test-shinytest2.R
      _snaps/          # expected values and screenshots

# Legacy shinytest layout (still accepted): tests/shinytest/`,
    tags: ['shinytest', 'testing'],
    references: [
      'https://rstudio.github.io/shinytest2/',
      'https://rstudio.github.io/shinytest2/articles/z-migration.html',
    ],
  },
  {
    id: 'shinytest-recordings',
    title: 'Create test recordings with record_test()',
    workflow: 'shinytest',
    category: 'testing',
    severity: 'important',
    enforcement: 'automated',
    description: 'Use shinytest2::record_test() to record interactive user workflows',
    details:
      'Recording a session captures real user interactions and expected values without hand-writing driver code. Run shinytest2::record_test() in the app directory, interact with the app, and save the generated test, which is written to tests/testthat/test-shinytest2.R. The automated check is a keyword heuristic: it flags projects where no .R file anywhere under tests/ (comments ignored) contains one of AppDriver$new(, test_app(, record_test(, recordTest(, ShinyDriver$new( or testApp(. The shinytest2 APIs are AppDriver$new, test_app and record_test; recordTest, ShinyDriver$new and testApp belong to the legacy shinytest package. It does not check that the tests make meaningful assertions.',
    badExample: `# tests/testthat/test-math.R
test_that("math works", {
  expect_equal(1 + 1, 2)
})
# no test drives the running app`,
    goodExample: `# In the app directory: shinytest2::record_test()
# Generated tests/testthat/test-shinytest2.R
library(shinytest2)

test_that("app shows the default plot", {
  app <- AppDriver$new(name = "default", height = 600, width = 800)
  app$set_inputs(n = 50)
  app$expect_values()
})`,
    tags: ['shinytest', 'recording'],
    references: [
      'https://rstudio.github.io/shinytest2/reference/record_test.html',
      'https://rstudio.github.io/shinytest2/articles/shinytest2.html',
    ],
  },
  {
    id: 'shinytest-unit-tests',
    title: 'Combine with testthat unit tests',
    workflow: 'shinytest',
    category: 'testing',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Use testthat for logic tests, shinytest2 for UI/integration tests',
    details:
      'Driving a browser is slow and coarse, so test business logic with fast testthat unit tests and keep app-level tests for the UI wiring. Put logic in plain functions and test them in tests/testthat/. The automated check reports a project without a tests/testthat/ directory.',
    badExample: `myapp/
  app.R          # all logic inline in server()
  tests/
    shinytest/
      mytest.R`,
    goodExample: `myapp/
  app.R
  R/
    summarise.R  # summarise_sales() as a plain function
  tests/
    testthat/
      test-summarise.R
      test-shinytest2.R   # shinytest2 AppDriver test

# test-summarise.R
test_that("summarise_sales totals by region", {
  out <- summarise_sales(data.frame(region = c("a", "a"), amount = 1:2))
  expect_equal(out$total, 3)
})`,
    tags: ['shinytest', 'testing', 'testthat'],
    references: ['https://mastering-shiny.org/scaling-testing.html', 'https://testthat.r-lib.org/'],
  },
  {
    id: 'shinytest-ci-integration',
    title: 'Run tests in CI/CD pipeline',
    workflow: 'shinytest',
    category: 'testing',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Use GitHub Actions or similar to run tests automatically',
    details:
      'Tests that only run on one laptop stop catching regressions. Run them on every push and pull request in CI, with the app dependencies installed. The automated check reads the workflow files in .github/workflows/ (.yml or .yaml) and, if present, .gitlab-ci.yml, .travis.yml, .circleci/config.yml and azure-pipelines.yml, ignoring full-line YAML comments. It counts any of these as evidence that tests run: shinytest2 or shinytest (also as a package name in an install step), testthat::test_*, devtools::test, rcmdcheck, check-r-package, R CMD check, test_dir or test_app (case-insensitive). The bare word testthat is not enough. This is a keyword heuristic; it does not check that the job succeeds or is triggered on push.',
    badExample: `myapp/
  app.R
  tests/
    testthat/
      test-app.R
# no CI configuration: tests are run by hand`,
    goodExample: `# .github/workflows/test.yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: r-lib/actions/setup-r@v2
      - uses: r-lib/actions/setup-r-dependencies@v2
        with:
          extra-packages: any::testthat, any::shinytest2
      - run: Rscript -e 'testthat::test_dir("tests/testthat", stop_on_failure = TRUE)'`,
    tags: ['shinytest', 'ci', 'automation'],
    references: [
      'https://usethis.r-lib.org/reference/use_github_action.html',
      'https://rstudio.github.io/shinytest2/articles/use-ci.html',
    ],
  },
  {
    id: 'shinytest-app',
    title: 'Test a runnable Shiny app',
    workflow: 'shinytest',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'The project needs a Shiny app to test: app.R, or both ui.R and server.R',
    details:
      'The driver launches the app from its directory, so the project must contain an app that starts on its own. Keep app.R (ending in shinyApp()) or the pair ui.R and server.R at the root of the tested directory. The automated check passes when app.R exists, or when both ui.R and server.R exist, in the project root; it reports a project with neither and does not check that the app actually starts.',
    badExample: `tests/
  shinytest/
    mytest.R
# no app.R: AppDriver$new() has nothing to launch`,
    goodExample: `app.R              # or: ui.R + server.R
tests/
  testthat/
    test-shinytest2.R

# test-shinytest2.R
test_that("the app starts", {
  app <- shinytest2::AppDriver$new(app_dir = "../..")
  on.exit(app$stop())
  app$expect_values()
})`,
    tags: ['shinytest', 'shiny'],
    references: [
      'https://rstudio.github.io/shinytest2/reference/AppDriver.html',
      'https://rstudio.github.io/shinytest2/articles/shinytest2.html',
    ],
  },
  {
    id: 'shinytest-setup',
    title: 'Add a test setup configuration',
    workflow: 'shinytest',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Keep shared test setup in tests/testthat/setup-shinytest2.R',
    details:
      "Shared setup such as attaching packages, setting options or creating fixture data belongs in one place so every test starts from the same state. With shinytest2, tests/testthat/setup-shinytest2.R is loaded by testthat before the tests, and shinytest2::load_app_env() there makes the functions in the app's R/ directory and global.R available to the tests. The automated check applies when tests/testthat/ or tests/shinytest/ exists and passes if any of these files exists: tests/testthat/setup-shinytest2.R, tests/testthat/setup-shinytest.R, tests/testthat/setup.R, tests/setup.R or the legacy tests/shinytest/setup.R. It does not check the content.",
    badExample: `# tests/testthat/test-shinytest2.R and every other test file
library(shinytest2)
source("../../R/helpers.R")
Sys.setenv(APP_ENV = "test")
# the same lines are copied into every test file
# and tests/testthat/ has no setup file`,
    goodExample: `# tests/testthat/setup-shinytest2.R
shinytest2::load_app_env()
Sys.setenv(APP_ENV = "test")

# tests/testthat/test-shinytest2.R
test_that("the app loads", {
  app <- shinytest2::AppDriver$new(name = "loads")
  app$expect_values()
})`,
    tags: ['shinytest', 'setup'],
    references: [
      'https://rstudio.github.io/shinytest2/reference/load_app_env.html',
      'https://rstudio.github.io/shinytest2/reference/AppDriver.html',
    ],
  },
];
