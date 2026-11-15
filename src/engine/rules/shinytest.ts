import type { ProjectFs } from '../project-fs.js';
import { RuleDef } from './types.js';
import {
  anyExists,
  findFiles,
  isDirectoryAt,
  maskRSource,
  pathExists,
  readText,
} from './helpers.js';

function stripComments(text: string): string {
  return maskRSource(text, false);
}

async function isDir(fsys: ProjectFs, p: string): Promise<boolean> {
  try {
    return (await fsys.stat(p)).isDirectory;
  } catch {
    return false;
  }
}

/** Drops full-line YAML comments (`# ...`) so commented-out steps do not count. */
function yamlWithoutComments(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

// shinytest2 (AppDriver, test_app, record_test) and the legacy shinytest API (recordTest, ShinyDriver, testApp).
const RECORDING_PATTERN =
  /AppDriver\$new\(|\btest_app\(|\brecordTest\(|\brecord_test\(|ShinyDriver\$new\(|\btestApp\(/;

// Evidence that tests are actually run; the bare word "testthat" (e.g. in an install step) is not.
// Installing the package (e.g. `extra-packages: any::shinytest2`) is not evidence either.
const CI_PATTERN =
  /shinytest2?::|shinytest2?\.R|testthat::test_|devtools::test|rcmdcheck|check-r-package|R CMD check|\btest_dir\b|\btest_app\b|\btestApp\b/i;

/** shinytest2 runs through testthat; legacy shinytest uses tests/shinytest/. */
async function hasTestDir(fsys: ProjectFs, dirPath: string): Promise<boolean> {
  return (
    (await isDirectoryAt(fsys, `${dirPath}/tests/shinytest`)) ||
    (await isDirectoryAt(fsys, `${dirPath}/tests/testthat`))
  );
}

export const shinytestRules: RuleDef[] = [
  {
    id: 'shinytest-structure',
    workflows: ['shinytest'],
    async run({ dirPath, fsys }) {
      if (await hasTestDir(fsys, dirPath)) return [];
      return [
        {
          id: 'shinytest-structure',
          severity: 'important',
          category: 'structure',
          message: 'Shinytest project should have tests/shinytest/ or tests/testthat/ directory',
          suggestions: [
            'Create tests/testthat/ for shinytest2 tests (shinytest2::use_shinytest2())',
            'Or create tests/shinytest/ for legacy shinytest recordings',
          ],
        },
      ];
    },
  },
  {
    id: 'shinytest-app',
    workflows: ['shinytest'],
    async run({ dirPath, fsys }) {
      const appR = await pathExists(fsys, `${dirPath}/app.R`);
      const uiServer =
        (await pathExists(fsys, `${dirPath}/ui.R`)) &&
        (await pathExists(fsys, `${dirPath}/server.R`));
      if (appR || uiServer) return [];
      return [
        {
          id: 'shinytest-app',
          severity: 'important',
          category: 'structure',
          message: 'Shinytest requires Shiny app.R or ui.R/server.R',
          suggestions: ['Create app.R containing the Shiny app', 'Or create ui.R and server.R'],
        },
      ];
    },
  },
  {
    id: 'shinytest-setup',
    workflows: ['shinytest'],
    async run({ dirPath, fsys }) {
      if (!(await hasTestDir(fsys, dirPath))) return [];
      const setupFiles = [
        'tests/testthat/setup-shinytest2.R',
        'tests/testthat/setup-shinytest.R',
        'tests/testthat/setup.R',
        'tests/setup.R',
        'tests/shinytest/setup.R',
      ];
      if (await anyExists(fsys, dirPath, setupFiles)) return [];
      return [
        {
          id: 'shinytest-setup',
          severity: 'recommended',
          category: 'structure',
          message: 'Shinytest project should have test setup configuration',
          suggestions: ['Create tests/testthat/setup-shinytest2.R to configure the app under test'],
        },
      ];
    },
  },
  {
    id: 'shinytest-recordings',
    workflows: ['shinytest'],
    async run({ dirPath, fsys }) {
      const testFiles = await findFiles(fsys, fsys.join(dirPath, 'tests'), /\.[Rr]$/);
      for (const file of testFiles) {
        const text = await readText(fsys, file);
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
    async run({ dirPath, fsys }) {
      if (await isDir(fsys, fsys.join(dirPath, 'tests', 'testthat'))) return [];
      return [
        {
          id: 'shinytest-unit-tests',
          severity: 'recommended',
          category: 'testing',
          message:
            'Consider adding tests/testthat/ with testthat unit tests next to the Shiny tests',
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
    async run({ dirPath, fsys }) {
      const workflows = await findFiles(
        fsys,
        fsys.join(dirPath, '.github', 'workflows'),
        /\.ya?ml$/i,
        {
          includeHidden: true,
        }
      );
      const otherCi = [
        fsys.join(dirPath, '.gitlab-ci.yml'),
        fsys.join(dirPath, '.travis.yml'),
        fsys.join(dirPath, '.circleci', 'config.yml'),
        fsys.join(dirPath, 'azure-pipelines.yml'),
      ];
      for (const file of [...workflows, ...otherCi]) {
        if (!(await pathExists(fsys, file))) continue;
        const text = await readText(fsys, file);
        if (text !== null && CI_PATTERN.test(yamlWithoutComments(text))) return [];
      }
      return [
        {
          id: 'shinytest-ci-integration',
          severity: 'recommended',
          category: 'testing',
          message: 'No CI configuration runs the Shiny tests',
          details:
            'No file in .github/workflows/ (or .gitlab-ci.yml, .travis.yml, .circleci/config.yml, azure-pipelines.yml) runs tests: none mentions shinytest, shinytest2, testthat::test_*, devtools::test, rcmdcheck, R CMD check, check-r-package, test_dir or test_app.',
          suggestions: [
            'Add .github/workflows/test.yaml that sets up R (r-lib/actions/setup-r) and runs testthat::test_dir("tests/testthat") or shinytest2::test_app()',
            'Use r-lib/actions/setup-r-dependencies to install the app dependencies in CI',
          ],
        },
      ];
    },
  },
];
