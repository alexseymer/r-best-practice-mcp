import { Practice } from '../../types/practice.js';

export const shinytestPractices: Practice[] = [
  {
    id: 'shinytest-structure',
    title: 'Organize tests in tests/shinytest/ directory',
    workflow: 'shinytest',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Keep shinytest recordings and configurations organized',
    details:
      'Keeping app tests in a predictable place lets tools and teammates find, run and review them. The legacy shinytest package stores recordings in tests/shinytest/, while shinytest2 uses tests/testthat/. The automated check reports a project that has no tests/shinytest/ directory.',
    badExample: `myapp/
  app.R
  test_app_1.R
  recording.R`,
    goodExample: `myapp/
  app.R
  tests/
    shinytest.R
    shinytest/
      setup.R
      mytest.R
      mytest-expected/`,
    tags: ['shinytest', 'testing'],
    references: [
      'https://rstudio.github.io/shinytest2/',
      'https://rstudio.github.io/shinytest2/articles/z-migration.html',
    ],
  },
  {
    id: 'shinytest-recordings',
    title: 'Create test recordings with recordTest()',
    workflow: 'shinytest',
    category: 'testing',
    severity: 'important',
    enforcement: 'automated',
    description: 'Use shinytest::recordTest() to record interactive user workflows',
    details:
      'Recording a session captures real user interactions and expected values without hand-writing driver code. Run the recorder in the app directory, interact with the app, and save the generated test. The automated check is a keyword heuristic: it flags projects where no R file under tests/ mentions AppDriver$new(, test_app(, record_test(, recordTest(, ShinyDriver$new( or testApp(.',
    badExample: `# tests/testthat/test-app.R
test_that("math works", {
  expect_equal(1 + 1, 2)
})
# no test drives the running app`,
    goodExample: `# In the app directory: shinytest2::record_test()
# Generated tests/testthat/test-app.R
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
    description: 'Use testthat for logic tests, shinytest for UI/integration tests',
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
      test-app.R   # shinytest2 AppDriver test

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
      'Tests that only run on one laptop stop catching regressions. Run them on every push and pull request in CI, with the app dependencies installed. The automated check looks in .github/workflows/*.yml (and .gitlab-ci.yml, .circleci/config.yml, azure-pipelines.yml) for shinytest, shinytest2, testthat, test_dir or check-r-package.',
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
      'https://rstudio.github.io/shinytest2/articles/shinytest2.html',
    ],
  },
  {
    id: 'shinytest-app',
    title: 'Test a runnable Shiny app',
    workflow: 'shinytest',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Shinytest needs a Shiny app (app.R or ui.R and server.R) in the project to test',
    details:
      'The driver launches the app from its directory, so the project must contain an app that starts on its own. Keep app.R (ending in shinyApp()) at the root of the tested directory. The automated check reports a project that has no app.R in its root.',
    badExample: `tests/
  shinytest/
    mytest.R
# no app.R: AppDriver$new() has nothing to launch`,
    goodExample: `app.R
tests/
  testthat/
    test-app.R

# test-app.R
app <- shinytest2::AppDriver$new(app_dir = "../..")
app$stop()`,
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
    description: 'Keep shared test setup in tests/shinytest/setup.R',
    details:
      'Shared setup such as attaching packages, setting options or creating fixture data belongs in one place so every test starts from the same state. Put it in a setup file that the test runner loads first. The automated check applies when tests/shinytest/ exists and looks for tests/testthat/setup-shinytest.R, tests/setup.R or tests/shinytest/setup.R.',
    badExample: `# tests/shinytest/mytest.R
library(shinytest)
options(shiny.testmode = TRUE)
Sys.setenv(APP_ENV = "test")
# the same lines are copied into every test file`,
    goodExample: `# tests/shinytest/setup.R
library(shinytest)
options(shiny.testmode = TRUE)
Sys.setenv(APP_ENV = "test")

# tests/shinytest/mytest.R
app <- ShinyDriver$new("../../")
app$snapshotInit("mytest")`,
    tags: ['shinytest', 'setup'],
    references: [
      'https://rstudio.github.io/shinytest2/articles/robust.html',
      'https://rstudio.github.io/shinytest2/reference/AppDriver.html',
    ],
  },
];
