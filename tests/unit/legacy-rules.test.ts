import { ALL_PRACTICES } from '../../src/data/practices/index';
import { Validator } from '../../src/engine/validator';
import { Finding } from '../../src/types/finding';
import { Workflow } from '../../src/types/workflow';
import { cleanupTempDir, createDir, createFile, createTempDir } from '../fixtures/setup';
import { findingsFor, idsFor } from '../fixtures/rules';

const FULL_DESC =
  'Package: pkg\nVersion: 0.1.0\nTitle: T\nDescription: D.\nLicense: GPL-3\nAuthors@R: person("A", "B")\n';

describe('legacy validator rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  const only = async (wf: Workflow, id: string): Promise<Finding[]> =>
    (await findingsFor(dir, wf)).filter((f) => f.id === id);

  describe('analysis-readme', () => {
    it('is emitted by the analysis workflow when README is absent', async () => {
      const f = await only('analysis', 'analysis-readme');
      expect(f).toHaveLength(1);
      expect(f[0].severity).toBe('recommended');
      expect(f[0].category).toBe('documentation');
      expect(f[0].suggestions?.length).toBeGreaterThan(0);
    });
    it.each(['README.md', 'README.Rmd', 'README'])('accepts %s', async (name) => {
      createFile(dir, name, '# x');
      expect(await only('analysis', 'analysis-readme')).toHaveLength(0);
    });
    it('is no longer emitted by the quarto workflow', async () => {
      createFile(dir, 'a.qmd', '---\ntitle: x\n---\n');
      expect(await idsFor(dir, 'quarto')).not.toContain('analysis-readme');
    });
  });

  describe('quarto-labels', () => {
    const run = async (content: string) => {
      createFile(dir, 'a.qmd', content);
      return only('quarto', 'quarto-labels');
    };
    it('flags unlabelled R chunks and reports the first line', async () => {
      const f = await run('---\ntitle: x\n---\n\n```{r}\n1\n```\n\n```{r, echo=FALSE}\n2\n```\n');
      expect(f).toHaveLength(1);
      expect(f[0].line).toBe(5);
      expect(f[0].severity).toBe('recommended');
      expect(f[0].category).toBe('structure');
      expect(f[0].suggestions?.join(' ')).toContain('#| label:');
    });
    it('flags chunks with only non-label options', async () => {
      expect(await run('---\n---\n```{r, echo=FALSE}\n1\n```\n')).toHaveLength(1);
      expect(await run('---\n---\n```{r}\n#| echo: false\n1\n```\n')).toHaveLength(1);
    });
    it.each([
      '```{r mylabel}\n1\n```',
      '```{r mylabel, echo=FALSE}\n1\n```',
      '```{r, label=mylabel}\n1\n```',
      '```{r}\n#| label: mylabel\n1\n```',
      '```{r}\n#| echo: false\n#| label: mylabel\n1\n```',
      '```{r, label: x}\n1\n```',
    ])('accepts labelled chunk %#', async (chunk) => {
      expect(await run(`---\n---\n${chunk}\n`)).toHaveLength(0);
    });
    it('ignores non-R chunks and handles CRLF', async () => {
      expect(await run('---\n---\n```{python}\n1\n```\n')).toHaveLength(0);
      expect(await run('---\r\n---\r\n```{r}\r\n#| label: a\r\n1\r\n```\r\n')).toHaveLength(0);
      expect(await run('---\r\n---\r\n```{r mylabel}\r\n1\r\n```\r\n')).toHaveLength(0);
      expect(await run('---\r\n---\r\n```{r}\r\n1\r\n```\r\n')).toHaveLength(1);
    });
    it('does not treat an option after the options block as a label', async () => {
      expect(await run('---\n---\n```{r}\nx <- 1\n#| label: late\n```\n')).toHaveLength(1);
    });
  });

  describe('pkg-description', () => {
    const run = async (desc: string) => {
      createFile(dir, 'DESCRIPTION', desc);
      createDir(dir, 'R');
      createDir(dir, 'tests');
      return only('package', 'pkg-description');
    };
    it('reports one finding listing all missing fields', async () => {
      const f = await run('Package: pkg\nVersion: 1\n');
      expect(f).toHaveLength(1);
      expect(f[0].severity).toBe('critical');
      expect(f[0].category).toBe('structure');
      for (const name of ['Title', 'Description', 'License', 'Authors@R']) {
        expect(f[0].message).toContain(name);
      }
      expect(f[0].message).not.toContain('Package,');
      expect(f[0].suggestions?.length).toBeGreaterThan(0);
    });
    it('accepts Authors@R or Author+Maintainer', async () => {
      expect(await run(FULL_DESC)).toHaveLength(0);
      const alt = FULL_DESC.replace(/Authors@R.*\n/, 'Author: A\nMaintainer: A <a@b.c>\n');
      expect(await run(alt)).toHaveLength(0);
    });
    it('requires both Author and Maintainer', async () => {
      const f = await run(FULL_DESC.replace(/Authors@R.*\n/, 'Author: A\n'));
      expect(f).toHaveLength(1);
      expect(f[0].message).toContain('Authors@R');
    });
    it('matches names at line start, not substrings', async () => {
      const f = await run(
        'Package: pkg\nVersion: 1\nTitle: T\nDescription: D\nLicense: MIT\nURL: x\nSuggests: Authors@R: Maintainer: Author:\n'
      );
      expect(f).toHaveLength(1);
      expect(f[0].message).toContain('Authors@R');
    });
  });

  describe('pkg-license', () => {
    const run = async (desc: string, files: string[] = []) => {
      createFile(dir, 'DESCRIPTION', desc);
      createDir(dir, 'R');
      createDir(dir, 'tests');
      files.forEach((f) => createFile(dir, f, 'x'));
      return only('package', 'pkg-license');
    };
    it('flags a DESCRIPTION without License', async () => {
      const f = await run(FULL_DESC.replace(/License.*\n/, ''));
      expect(f).toHaveLength(1);
      expect(f[0].severity).toBe('critical');
      expect(f[0].category).toBe('structure');
      expect(f[0].suggestions?.length).toBeGreaterThan(0);
    });
    it('flags "file LICENSE" without the file', async () => {
      const f = await run(FULL_DESC.replace('GPL-3', 'MIT + file LICENSE'));
      expect(f).toHaveLength(1);
      expect(f[0].suggestions?.length).toBeGreaterThan(0);
    });
    it.each(['LICENSE', 'LICENSE.md', 'LICENCE', 'LICENCE.md'])('accepts file %s', async (n) => {
      expect(await run(FULL_DESC.replace('GPL-3', 'MIT + file LICENSE'), [n])).toHaveLength(0);
    });
    it('accepts standard licenses without a LICENSE file', async () => {
      expect(await run(FULL_DESC)).toHaveLength(0);
      expect(await run(FULL_DESC.replace('GPL-3', 'Apache License (>= 2)'))).toHaveLength(0);
    });
    it('emits nothing when DESCRIPTION is missing', async () => {
      expect(await only('package', 'pkg-license')).toHaveLength(0);
    });
  });

  describe('shinytest rules', () => {
    it('structure passes with tests/testthat or tests/shinytest', async () => {
      createFile(dir, 'app.R', 'x');
      expect(await only('shinytest', 'shinytest-structure')).toHaveLength(1);
      createDir(dir, 'tests/testthat');
      expect(await only('shinytest', 'shinytest-structure')).toHaveLength(0);
    });
    it('structure finding keeps severity/category and has suggestions', async () => {
      const f = (await only('shinytest', 'shinytest-structure'))[0];
      expect(f.severity).toBe('important');
      expect(f.category).toBe('structure');
      expect(f.suggestions?.length).toBeGreaterThan(0);
    });
    it('app passes with app.R or ui.R+server.R, not ui.R alone', async () => {
      expect(await only('shinytest', 'shinytest-app')).toHaveLength(1);
      createFile(dir, 'ui.R', 'x');
      expect(await only('shinytest', 'shinytest-app')).toHaveLength(1);
      createFile(dir, 'server.R', 'x');
      expect(await only('shinytest', 'shinytest-app')).toHaveLength(0);
    });
    it('setup accepts shinytest2 and testthat setup files', async () => {
      createDir(dir, 'tests/testthat');
      const f = await only('shinytest', 'shinytest-setup');
      expect(f).toHaveLength(1);
      expect(f[0].severity).toBe('recommended');
      expect(f[0].suggestions?.length).toBeGreaterThan(0);
      createFile(dir, 'tests/testthat/setup-shinytest2.R', 'x');
      expect(await only('shinytest', 'shinytest-setup')).toHaveLength(0);
    });
    it.each(['tests/testthat/setup.R', 'tests/testthat/setup-shinytest.R', 'tests/setup.R'])(
      'setup still accepts %s',
      async (rel) => {
        createDir(dir, 'tests/testthat');
        createFile(dir, rel, 'x');
        expect(await only('shinytest', 'shinytest-setup')).toHaveLength(0);
      }
    );
  });

  describe('bookdown-config', () => {
    it('is important, suggests _bookdown.yml, accepts either extension', async () => {
      const f = (await only('bookdown', 'bookdown-config'))[0];
      expect(f.severity).toBe('important');
      expect(f.category).toBe('structure');
      expect(f.suggestions?.join(' ')).toContain('_bookdown.yml');
      createFile(dir, '_bookdown.yaml', 'x');
      expect(await only('bookdown', 'bookdown-config')).toHaveLength(0);
    });
    it('accepts _bookdown.yml', async () => {
      createFile(dir, '_bookdown.yml', 'x');
      expect(await only('bookdown', 'bookdown-config')).toHaveLength(0);
    });
    it('practice severity matches the rule', () => {
      expect(ALL_PRACTICES.find((p) => p.id === 'bookdown-config')?.severity).toBe('important');
    });
  });

  describe('rscript-globals', () => {
    const assigns = (n: number) =>
      Array.from({ length: n }, (_, i) => `v${i} <- ${i}`).join('\n') + '\n';
    it('does not flag scripts with 15 or fewer top-level assignments', async () => {
      createFile(dir, 'a.R', '# header\n' + assigns(15));
      expect(await only('r-script', 'rscript-globals')).toHaveLength(0);
    });
    it('emits ONE finding for a script with more than 15', async () => {
      createFile(dir, 'a.R', '# header\n' + assigns(30));
      const f = await only('r-script', 'rscript-globals');
      expect(f).toHaveLength(1);
      expect(f[0].message).toMatch(/^Consider/);
      expect(f[0].severity).toBe('important');
      expect(f[0].category).toBe('structure');
      expect(f[0].suggestions?.join(' ')).toMatch(/functions/);
      expect(f[0].suggestions?.join(' ')).toMatch(/main\(\)/);
    });
    it('ignores function definitions, comments, indented lines and ==', async () => {
      const body =
        Array.from({ length: 20 }, (_, i) => `f${i} <- function(x) x`).join('\n') +
        '\n' +
        Array.from({ length: 20 }, (_, i) => `# c${i} <- 1`).join('\n') +
        '\n' +
        Array.from({ length: 20 }, (_, i) => `  v${i} <- 1`).join('\n') +
        '\n';
      createFile(dir, 'a.R', '# h\n' + body);
      expect(await only('r-script', 'rscript-globals')).toHaveLength(0);
    });
    it('counts = assignments and picks the first offending script only', async () => {
      createFile(dir, 'a.R', '# h\n' + assigns(3));
      createFile(dir, 'b.R', Array.from({ length: 20 }, (_, i) => `x${i} = ${i}`).join('\n'));
      createFile(dir, 'c.R', assigns(40));
      const f = await only('r-script', 'rscript-globals');
      expect(f).toHaveLength(1);
      expect(f[0].file).toMatch(/b\.R$/);
    });
  });

  describe('plumber rules', () => {
    const api = (body: string) => `#* @get /x\nfunction() {\n${body}\n}\n`;
    it('ignores R files without endpoint annotations', async () => {
      createFile(dir, 'helpers.R', 'f <- function() 1\n');
      const ids = await idsFor(dir, 'plumber');
      expect(ids).not.toContain('plumber-validation');
      expect(ids).not.toContain('plumber-error');
    });
    it.each(['#* @post /y', "#' @put /y", '#* @delete /y', '#* @patch /y'])(
      'recognises annotation %s',
      async (a) => {
        createFile(dir, 'api.R', `${a}\nfunction() 1\n`);
        expect(await idsFor(dir, 'plumber')).toEqual(
          expect.arrayContaining(['plumber-validation', 'plumber-error'])
        );
      }
    );
    it('flags an endpoint with no validation or error handling', async () => {
      createFile(dir, 'api.R', api('  list(a = 1)'));
      const f = await findingsFor(dir, 'plumber');
      const v = f.find((x) => x.id === 'plumber-validation');
      const e = f.find((x) => x.id === 'plumber-error');
      expect(v?.severity).toBe('critical');
      expect(v?.category).toBe('security');
      expect(e?.severity).toBe('important');
      expect(e?.category).toBe('structure');
      expect(e?.suggestions?.length).toBeGreaterThan(0);
    });
    it('is not satisfied by comments', async () => {
      createFile(
        dir,
        'api.R',
        api('  # validate input, if (bad) stop("x") inside tryCatch(\n  list(a = 1)')
      );
      expect(await idsFor(dir, 'plumber')).toEqual(
        expect.arrayContaining(['plumber-validation', 'plumber-error'])
      );
    });
    it('passes when code validates and handles errors', async () => {
      createFile(
        dir,
        'api.R',
        api('  if (is.null(x)) stop("bad")\n  tryCatch(list(a = 1), error = function(e) NULL)')
      );
      const ids = await idsFor(dir, 'plumber');
      expect(ids).not.toContain('plumber-validation');
      expect(ids).not.toContain('plumber-error');
    });
  });

  describe('blogdown-config', () => {
    it('flags a site with no config', async () => {
      const f = await only('blogdown', 'blogdown-config');
      expect(f).toHaveLength(1);
      expect(f[0].severity).toBe('critical');
      expect(f[0].suggestions?.length).toBeGreaterThan(0);
    });
    it.each([
      'config.toml',
      'config.yaml',
      'config.yml',
      'hugo.toml',
      'hugo.yaml',
      'hugo.yml',
      'config/_default/hugo.toml',
    ])('accepts %s', async (rel) => {
      createFile(dir, rel, 'x');
      expect(await only('blogdown', 'blogdown-config')).toHaveLength(0);
    });
    it('accepts an empty config/_default/ directory', async () => {
      createDir(dir, 'config/_default');
      expect(await only('blogdown', 'blogdown-config')).toHaveLength(0);
    });
  });

  describe('severity/category audit against practices', () => {
    type Case = [Workflow, string, (d: string) => void];
    const cases: Case[] = [
      ['analysis', 'analysis-readme', () => undefined],
      ['analysis', 'analysis-structure', () => undefined],
      ['blogdown', 'blogdown-config', () => undefined],
      ['blogdown', 'blogdown-content-structure', () => undefined],
      ['blogdown', 'blogdown-theme', () => undefined],
      ['bookdown', 'bookdown-config', () => undefined],
      ['bookdown', 'bookdown-index', () => undefined],
      ['bookdown', 'bookdown-readme', () => undefined],
      ['package', 'pkg-description', (d) => createFile(d, 'DESCRIPTION', 'Package: x\n')],
      [
        'package',
        'pkg-license',
        (d) => createFile(d, 'DESCRIPTION', FULL_DESC.replace(/License.*\n/, '')),
      ],
      ['package', 'pkg-structure', (d) => createFile(d, 'DESCRIPTION', FULL_DESC)],
      ['package', 'pkg-tests', (d) => createFile(d, 'DESCRIPTION', FULL_DESC)],
      ['plumber', 'plumber-error', (d) => createFile(d, 'api.R', '#* @get /x\nfunction() 1\n')],
      [
        'plumber',
        'plumber-validation',
        (d) => createFile(d, 'api.R', '#* @get /x\nfunction() 1\n'),
      ],
      ['quarto', 'quarto-labels', (d) => createFile(d, 'a.qmd', '---\n---\n```{r}\n1\n```\n')],
      ['quarto', 'quarto-yaml', (d) => createFile(d, 'a.qmd', 'text\n')],
      ['renv', 'renv-lock', () => undefined],
      ['rmarkdown', 'rmd-yaml', (d) => createFile(d, 'a.Rmd', 'text\n')],
      [
        'r-script',
        'rscript-globals',
        (d) =>
          createFile(d, 'a.R', Array.from({ length: 20 }, (_, i) => `v${i} <- ${i}`).join('\n')),
      ],
      ['r-script', 'rscript-header', (d) => createFile(d, 'a.R', 'x <- 1\n')],
      ['shiny', 'shiny-readme', () => undefined],
      ['shiny', 'shiny-structure', () => undefined],
      ['shinytest', 'shinytest-app', () => undefined],
      ['shinytest', 'shinytest-structure', () => undefined],
      ['shinytest', 'shinytest-setup', (d) => createDir(d, 'tests/testthat')],
      ['targets', 'targets-structure', () => undefined],
    ];

    it.each(cases)('%s / %s matches its practice and has suggestions', async (wf, id, setup) => {
      setup(dir);
      const finding = (await findingsFor(dir, wf)).find((f) => f.id === id);
      const practice = ALL_PRACTICES.find((p) => p.id === id);
      expect(finding).toBeDefined();
      expect(practice).toBeDefined();
      expect(finding?.severity).toBe(practice?.severity);
      expect(finding?.category).toBe(practice?.category);
      expect(finding?.suggestions?.length).toBeGreaterThan(0);
    });

    it('rscript-functions (file-level) matches its practice and has suggestions', async () => {
      const file = createFile(dir, 'a.R', '# h\n' + 'print(1)\n'.repeat(60));
      const f = (await new Validator().validateFile(file)).find(
        (x) => x.id === 'rscript-functions'
      );
      const practice = ALL_PRACTICES.find((p) => p.id === 'rscript-functions');
      expect(f?.severity).toBe(practice?.severity);
      expect(f?.category).toBe(practice?.category);
      expect(f?.suggestions?.length).toBeGreaterThan(0);
    });

    it('targets-structure (list() variant) also matches and has suggestions', async () => {
      createFile(dir, '_targets.R', 'library(targets)\n');
      const f = (await findingsFor(dir, 'targets')).find((x) => x.id === 'targets-structure');
      expect(f?.severity).toBe('recommended');
      expect(f?.suggestions?.length).toBeGreaterThan(0);
    });

    it('validation-error findings carry suggestions', async () => {
      // A path that cannot be listed makes validateProject fall into the catch branch.
      const result = await new Validator().validateProject(`${dir}/\0bad`, 'r-script');
      const f = result.findings.find((x) => x.id === 'validation-error');
      if (f) expect(f.suggestions?.length).toBeGreaterThan(0);
    });
  });
});
