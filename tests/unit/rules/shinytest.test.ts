import { createTempDir, cleanupTempDir, createFile, createDir } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';

describe('shinytest rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('shinytest-recordings', () => {
    it('reports a project with no tests/ directory', async () => {
      createFile(dir, 'app.R', 'library(shiny)\n');
      const found = (await findingsFor(dir, 'shinytest')).filter(
        (f) => f.id === 'shinytest-recordings'
      );
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('recommended');
      expect(found[0].category).toBe('testing');
      expect(found[0].message.length).toBeGreaterThan(0);
      expect(found[0].suggestions?.length).toBeGreaterThan(0);
    });

    it('reports tests that never drive the app', async () => {
      createFile(dir, 'tests/testthat/test-math.R', 'test_that("a", expect_equal(1, 1))\n');
      expect(await idsFor(dir, 'shinytest')).toContain('shinytest-recordings');
    });

    it.each([
      'app <- AppDriver$new(name = "x")',
      'shinytest2::test_app()',
      'shinytest::recordTest("app")',
      'shinytest2::record_test()',
      'app <- ShinyDriver$new("../../")',
    ])('is satisfied by %s', async (snippet) => {
      createFile(dir, 'tests/testthat/test-app.R', `${snippet}\n`);
      expect(await idsFor(dir, 'shinytest')).not.toContain('shinytest-recordings');
    });

    it('is satisfied by a nested lowercase .r file and CRLF endings', async () => {
      createFile(dir, 'tests/shinytest/mytest.r', 'app <- ShinyDriver$new("../../")\r\n');
      expect(await idsFor(dir, 'shinytest')).not.toContain('shinytest-recordings');
    });

    it('is not satisfied by a keyword only in a comment', async () => {
      createFile(dir, 'tests/testthat/test-app.R', '# use AppDriver$new( later\n');
      expect(await idsFor(dir, 'shinytest')).toContain('shinytest-recordings');
    });
  });

  describe('shinytest-unit-tests', () => {
    it('reports a project without tests/testthat/', async () => {
      createDir(dir, 'tests/shinytest');
      const found = (await findingsFor(dir, 'shinytest')).filter(
        (f) => f.id === 'shinytest-unit-tests'
      );
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('recommended');
      expect(found[0].category).toBe('testing');
      expect(found[0].message).toContain('Consider adding tests/testthat/');
      expect(found[0].suggestions?.length).toBeGreaterThan(0);
    });

    it('is satisfied by tests/testthat/', async () => {
      createDir(dir, 'tests/testthat');
      expect(await idsFor(dir, 'shinytest')).not.toContain('shinytest-unit-tests');
    });

    it('is not satisfied by a file named tests/testthat', async () => {
      createFile(dir, 'tests/testthat', 'not a directory\n');
      expect(await idsFor(dir, 'shinytest')).toContain('shinytest-unit-tests');
    });
  });

  describe('shinytest-ci-integration', () => {
    it('reports a project without any CI file', async () => {
      createFile(dir, 'app.R', 'library(shiny)\n');
      const found = (await findingsFor(dir, 'shinytest')).filter(
        (f) => f.id === 'shinytest-ci-integration'
      );
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('recommended');
      expect(found[0].category).toBe('testing');
      expect(found[0].message.length).toBeGreaterThan(0);
      expect(found[0].suggestions?.length).toBeGreaterThan(0);
    });

    it('reports a workflow that does not run tests', async () => {
      createFile(
        dir,
        '.github/workflows/lint.yaml',
        'name: lint\njobs:\n  lint:\n    steps:\n      - run: lintr\n'
      );
      expect(await idsFor(dir, 'shinytest')).toContain('shinytest-ci-integration');
    });

    it.each([
      'shinytest',
      'shinytest2',
      'testthat::test_dir("tests")',
      'devtools::test()',
      'rcmdcheck::rcmdcheck()',
      'R CMD check .',
      'shiny::test_app()',
      'test_dir',
    ])('is satisfied by a GitHub workflow that runs %s', async (word) => {
      createFile(dir, '.github/workflows/test.yml', `run: Rscript -e '${word}'\n`);
      expect(await idsFor(dir, 'shinytest')).not.toContain('shinytest-ci-integration');
    });

    it('is not satisfied by a workflow that merely mentions the word testthat', async () => {
      createFile(
        dir,
        '.github/workflows/lint.yaml',
        'steps:\n  - run: Rscript -e \'install.packages("testthat")\'\n  - run: lintr\n'
      );
      expect(await idsFor(dir, 'shinytest')).toContain('shinytest-ci-integration');
    });

    it('ignores commented-out test steps in a workflow', async () => {
      createFile(dir, '.github/workflows/ci.yaml', 'steps:\n  # - run: devtools::test()\n');
      expect(await idsFor(dir, 'shinytest')).toContain('shinytest-ci-integration');
    });

    it('is satisfied by .travis.yml', async () => {
      createFile(dir, '.travis.yml', 'language: r\nscript:\n  - Rscript -e "devtools::test()"\n');
      expect(await idsFor(dir, 'shinytest')).not.toContain('shinytest-ci-integration');
    });

    it('is satisfied by .gitlab-ci.yml', async () => {
      createFile(
        dir,
        '.gitlab-ci.yml',
        'test:\n  script:\n    - Rscript -e "testthat::test_dir(\'tests\')"\n'
      );
      expect(await idsFor(dir, 'shinytest')).not.toContain('shinytest-ci-integration');
    });

    it('is not satisfied by a non-workflow file mentioning testthat', async () => {
      createFile(dir, 'README.md', 'We use testthat\n');
      expect(await idsFor(dir, 'shinytest')).toContain('shinytest-ci-integration');
    });
  });

  it('does not run shinytest rules for other workflows', async () => {
    const ids = await idsFor(dir, 'shiny');
    expect(ids).not.toContain('shinytest-unit-tests');
    expect(ids).not.toContain('shinytest-ci-integration');
  });
});
