import fs from 'fs';
import path from 'path';
import { RuleDef } from './types.js';
import { findFiles, pathExists, readText } from './helpers.js';

function stripComments(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

// shinytest2 (AppDriver, test_app, record_test) and the legacy shinytest API (recordTest, ShinyDriver, testApp).
const RECORDING_PATTERN =
  /AppDriver\$new\(|\btest_app\(|\brecordTest\(|\brecord_test\(|ShinyDriver\$new\(|\btestApp\(/;

const CI_PATTERN = /shinytest2?|testthat|test_dir|check-r-package|devtools::test/i;

export const shinytestRules: RuleDef[] = [
  {
    id: 'shinytest-recordings',
    workflows: ['shinytest'],
    async run({ dirPath }) {
      const testFiles = await findFiles(path.join(dirPath, 'tests'), /\.[Rr]$/);
      for (const file of testFiles) {
        const text = await readText(file);
        if (text !== null && RECORDING_PATTERN.test(stripComments(text))) return [];
      }
      return [
        {
          id: 'shinytest-recordings',
          severity: 'recommended',
          category: 'testing',
          message:
            'Consider adding recorded Shiny tests: no R file under tests/ uses AppDriver$new(), test_app() or recordTest()',
          details: `Searched ${testFiles.length} R file(s) under tests/. This is a heuristic based on keyword search.`,
          suggestions: [
            'Run shinytest2::record_test() (or shinytest::recordTest()) in the app directory to record an interaction as a test',
            'Write tests/testthat/test-app.R using AppDriver$new(app_dir) and app$expect_values()',
          ],
        },
      ];
    },
  },
  {
    id: 'shinytest-unit-tests',
    workflows: ['shinytest'],
    async run({ dirPath }) {
      if (await isDir(path.join(dirPath, 'tests', 'testthat'))) return [];
      return [
        {
          id: 'shinytest-unit-tests',
          severity: 'recommended',
          category: 'testing',
          message: 'No tests/testthat/ directory: add testthat unit tests next to the Shiny tests',
          suggestions: [
            'Run usethis::use_testthat() or create tests/testthat/ manually',
            'Move app logic into plain functions (e.g. in R/) and unit test them with testthat',
          ],
        },
      ];
    },
  },
  {
    id: 'shinytest-ci-integration',
    workflows: ['shinytest'],
    async run({ dirPath }) {
      const workflows = await findFiles(path.join(dirPath, '.github', 'workflows'), /\.ya?ml$/i, {
        includeHidden: true,
      });
      const otherCi = [
        path.join(dirPath, '.gitlab-ci.yml'),
        path.join(dirPath, '.circleci', 'config.yml'),
        path.join(dirPath, 'azure-pipelines.yml'),
      ];
      for (const file of [...workflows, ...otherCi]) {
        if (!(await pathExists(file))) continue;
        const text = await readText(file);
        if (text !== null && CI_PATTERN.test(text)) return [];
      }
      return [
        {
          id: 'shinytest-ci-integration',
          severity: 'recommended',
          category: 'testing',
          message: 'No CI configuration runs the Shiny tests',
          details:
            'No file in .github/workflows/ (or .gitlab-ci.yml, .circleci/config.yml, azure-pipelines.yml) mentions shinytest, shinytest2, testthat, test_dir or check-r-package.',
          suggestions: [
            'Add .github/workflows/test.yaml that sets up R (r-lib/actions/setup-r) and runs testthat::test_dir("tests/testthat") or shinytest2::test_app()',
            'Use r-lib/actions/setup-r-dependencies to install the app dependencies in CI',
          ],
        },
      ];
    },
  },
];
