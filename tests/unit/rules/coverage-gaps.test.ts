import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { idsFor, findingsFor } from '../../fixtures/rules';
import { Workflow } from '../../../src/types/workflow';

/**
 * One violating and one clean project for each automated practice that no other rule test names.
 * Each case runs the real validator, so it also checks that the rule is registered for its workflow.
 */
const DESCRIPTION_OK = `Package: demo
Version: 0.1.0
Title: Tools for Demo
Description: Demo package for tests.
Authors@R: person("Ada", "Lovelace", email = "ada@example.org", role = c("aut", "cre"))
License: MIT + file LICENSE
`;

const globalsScript = Array.from({ length: 16 }, (_, i) => `x${i} <- ${i}`).join('\n') + '\n';

const cases: Array<{
  id: string;
  workflow: Workflow;
  violation: Record<string, string>;
  clean: Record<string, string>;
}> = [
  {
    id: 'rscript-globals',
    workflow: 'r-script',
    violation: { 'analysis.R': globalsScript },
    clean: { 'analysis.R': 'main <- function() {\n  1\n}\n' },
  },
  {
    id: 'quarto-labels',
    workflow: 'quarto',
    violation: { 'report.qmd': '---\ntitle: "R"\nformat: html\n---\n\n```{r}\n1 + 1\n```\n' },
    clean: { 'report.qmd': '---\ntitle: "R"\nformat: html\n---\n\n```{r}\n#| label: sum\n1 + 1\n```\n' },
  },
  {
    id: 'quarto-yaml',
    workflow: 'quarto',
    violation: { 'report.qmd': '# Report\n\n```{r}\n#| label: sum\n1 + 1\n```\n' },
    clean: { 'report.qmd': '---\ntitle: "Report"\nformat: html\n---\n\n```{r}\n#| label: sum\n1 + 1\n```\n' },
  },
  {
    id: 'rmd-yaml',
    workflow: 'rmarkdown',
    violation: { 'report.Rmd': '# Report\n\n```{r}\n1 + 1\n```\n' },
    clean: { 'report.Rmd': '---\ntitle: "Report"\noutput: html_document\n---\n\n```{r}\n1 + 1\n```\n' },
  },
  {
    id: 'shiny-readme',
    workflow: 'shiny',
    violation: { 'app.R': 'library(shiny)\n' },
    clean: { 'app.R': 'library(shiny)\n', 'README.md': '# App\n' },
  },
  {
    id: 'shiny-structure',
    workflow: 'shiny',
    violation: { 'README.md': '# App\n', 'helpers.R': '1\n' },
    clean: { 'README.md': '# App\n', 'app.R': 'library(shiny)\n' },
  },
  {
    id: 'pkg-description',
    workflow: 'package',
    violation: { DESCRIPTION: DESCRIPTION_OK.replace(/^Title:.*\n/m, '') },
    clean: { DESCRIPTION: DESCRIPTION_OK },
  },
  {
    id: 'pkg-tests',
    workflow: 'package',
    violation: { DESCRIPTION: DESCRIPTION_OK, 'R/demo.R': 'f <- function() 1\n' },
    clean: { DESCRIPTION: DESCRIPTION_OK, 'R/demo.R': 'f <- function() 1\n', 'tests/testthat/test-demo.R': 'test_that("f", expect_equal(f(), 1))\n' },
  },
  {
    id: 'pkg-license',
    workflow: 'package',
    violation: { DESCRIPTION: DESCRIPTION_OK.replace(/^License:.*\n/m, '') },
    clean: { DESCRIPTION: DESCRIPTION_OK, LICENSE: 'YEAR: 2026\nCOPYRIGHT HOLDER: Ada\n' },
  },
  {
    id: 'pkg-structure',
    workflow: 'package',
    violation: { DESCRIPTION: DESCRIPTION_OK, 'demo.R': 'f <- function() 1\n' },
    clean: { DESCRIPTION: DESCRIPTION_OK, 'R/demo.R': 'f <- function() 1\n' },
  },
  {
    id: 'renv-lock',
    workflow: 'renv',
    violation: { 'renv/activate.R': '# renv\n', 'analysis.R': 'x <- 1\n' },
    clean: { 'renv/activate.R': '# renv\n', 'renv.lock': '{"R": {"Version": "4.4.0"}}\n' },
  },
  {
    id: 'plumber-validation',
    workflow: 'plumber',
    violation: { 'plumber.R': '#* @param a A number\n#* @get /sum\nfunction(a) a + 1\n' },
    clean: {
      'plumber.R': '#* @param a A number\n#* @get /sum\nfunction(a) {\n  stopifnot(is.numeric(a))\n  a + 1\n}\n',
    },
  },
  {
    id: 'plumber-error',
    workflow: 'plumber',
    violation: { 'plumber.R': '#* @param a A number\n#* @get /sum\nfunction(a) {\n  stopifnot(is.numeric(a))\n  a + 1\n}\n' },
    clean: {
      'plumber.R':
        '#* @param a A number\n#* @get /sum\nfunction(a, res) {\n  stopifnot(is.numeric(a))\n  tryCatch(a + 1, error = function(e) { res$status <- 500; e })\n}\n',
    },
  },
  {
    id: 'analysis-structure',
    workflow: 'analysis',
    violation: { 'README.md': '# Analysis\n', 'data/raw.csv': 'a\n1\n' },
    clean: { 'README.md': '# Analysis\n', 'data/raw.csv': 'a\n1\n', 'R/clean.R': '1\n', 'output/.gitkeep': '' },
  },
  {
    id: 'analysis-readme',
    workflow: 'analysis',
    violation: { 'R/clean.R': '1\n' },
    clean: { 'R/clean.R': '1\n', 'README.md': '# Analysis\n' },
  },
  {
    id: 'bookdown-config',
    workflow: 'bookdown',
    violation: { 'index.Rmd': '---\ntitle: "Book"\n---\n' },
    clean: { 'index.Rmd': '---\ntitle: "Book"\n---\n', '_bookdown.yml': 'book_filename: "book"\n' },
  },
  {
    id: 'bookdown-index',
    workflow: 'bookdown',
    violation: { '_bookdown.yml': 'book_filename: "book"\n', 'chapter.Rmd': '# Chapter\n' },
    clean: { '_bookdown.yml': 'book_filename: "book"\n', 'index.Rmd': '---\ntitle: "Book"\n---\n' },
  },
  {
    id: 'blogdown-content-structure',
    workflow: 'blogdown',
    violation: { 'config.toml': 'baseURL = "/"\n', 'themes/x/theme.toml': 'name = "x"\n' },
    clean: { 'config.toml': 'baseURL = "/"\n', 'content/post.md': '# Post\n', 'themes/x/theme.toml': 'name = "x"\n' },
  },
  {
    id: 'blogdown-theme',
    workflow: 'blogdown',
    violation: { 'config.toml': 'baseURL = "/"\n', 'content/post.md': '# Post\n' },
    clean: { 'config.toml': 'baseURL = "/"\n', 'content/post.md': '# Post\n', 'themes/x/theme.toml': 'name = "x"\n' },
  },
  {
    id: 'shinytest-structure',
    workflow: 'shinytest',
    violation: { 'app.R': 'library(shiny)\n' },
    clean: { 'app.R': 'library(shiny)\n', 'tests/testthat/test-app.R': 'test_that("app", expect_true(TRUE))\n' },
  },
  {
    id: 'shinytest-app',
    workflow: 'shinytest',
    violation: { 'tests/testthat/test-app.R': 'test_that("app", expect_true(TRUE))\n' },
    clean: { 'app.R': 'library(shiny)\n', 'tests/testthat/test-app.R': 'test_that("app", expect_true(TRUE))\n' },
  },
  {
    id: 'shinytest-setup',
    workflow: 'shinytest',
    violation: { 'app.R': 'library(shiny)\n', 'tests/testthat/test-app.R': 'test_that("app", expect_true(TRUE))\n' },
    clean: {
      'app.R': 'library(shiny)\n',
      'tests/testthat/test-app.R': 'test_that("app", expect_true(TRUE))\n',
      'tests/testthat/setup-shinytest2.R': 'library(shinytest2)\n',
    },
  },
];

describe('rules without a named test: violation and clean project', () => {
  let dir: string;

  const write = (files: Record<string, string>): void => {
    for (const [name, content] of Object.entries(files)) createFile(dir, name, content);
  };

  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  it.each(cases)('$id reports a violation', async ({ id, workflow, violation }) => {
    write(violation);
    const found = (await findingsFor(dir, workflow)).filter((f) => f.id === id);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].message.length).toBeGreaterThan(0);
    expect(found[0].suggestions?.length ?? 0).toBeGreaterThan(0);
  });

  describe('pkg-description content', () => {
    const withField = (field: string, value: string) =>
      DESCRIPTION_OK.replace(new RegExp(`^${field}:.*$`, 'm'), `${field}: ${value}`);

    it.each([
      ['a trailing full stop in Title', withField('Title', 'Tools for Demo.')],
      ['a Title longer than 65 characters', withField('Title', 'Tools for ' + 'Very '.repeat(12) + 'Demo')],
      ['a Title that starts with "A package"', withField('Title', 'A Package for Demo Data')],
      ['a Description without a full stop', withField('Description', 'Demo package for tests')],
    ])('reports %s', async (_label, desc) => {
      write({ DESCRIPTION: desc });
      const found = (await findingsFor(dir, 'package')).filter((f) => f.id === 'pkg-description');
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('recommended');
      expect(found[0].message).toMatch(/^Consider/);
    });

    it('reports lowercase main words and names them', async () => {
      write({ DESCRIPTION: withField('Title', 'Tools for demo data') });
      const found = (await findingsFor(dir, 'package')).filter((f) => f.id === 'pkg-description');
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain('demo, data');
    });

    it.each([
      'Tools for Demo Data',
      'Tools for the Analysis of Data',
      "Tools for 'dplyr' Users",
      'Tools for ggplot2 Themes',
      'Simple Tools to Make Plots',
      'Tools for R Users',
    ])('accepts the title "%s"', async (title) => {
      write({ DESCRIPTION: withField('Title', title) });
      expect(await idsFor(dir, 'package')).not.toContain('pkg-description');
    });

    it('is silent on a well-formed DESCRIPTION', async () => {
      write({ DESCRIPTION: DESCRIPTION_OK });
      expect(await idsFor(dir, 'package')).not.toContain('pkg-description');
    });

    it('reads a multi-line Description and accepts it when it ends with a full stop', async () => {
      write({
        DESCRIPTION: DESCRIPTION_OK.replace(
          /^Description:.*$/m,
          'Description: Demo package for tests,\n    with a second line that ends the paragraph.'
        ),
      });
      expect(await idsFor(dir, 'package')).not.toContain('pkg-description');
    });
  });

  it('pkg-tests needs tests/testthat, not only some tests/ folder', async () => {
    write({ DESCRIPTION: DESCRIPTION_OK, 'R/demo.R': 'f <- function() 1\n', 'tests/manual/check.R': '1\n' });
    expect(await idsFor(dir, 'package')).toContain('pkg-tests');
  });

  it.each(cases)('$id is silent on a clean project', async ({ id, workflow, clean }) => {
    write(clean);
    expect(await idsFor(dir, workflow)).not.toContain(id);
  });
});

describe('lowercaseTitleWords', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { lowercaseTitleWords } = require('../../../src/engine/rules/package');

  it('always wants a capital on the first word, even a small one', () => {
    expect(lowercaseTitleWords('an Introduction to Tidy Data')).toEqual(['an']);
  });

  it('keeps small words lowercase in the middle', () => {
    expect(lowercaseTitleWords('Tools for the Analysis of Data')).toEqual([]);
  });

  it('skips quoted names and code-like words', () => {
    expect(lowercaseTitleWords("Wrappers for 'tidyverse' and rlang2 Helpers")).toEqual([]);
  });

  it('ignores trailing punctuation when judging a word', () => {
    expect(lowercaseTitleWords('Tools for Data (experimental)')).toEqual(['experimental']);
  });
});
