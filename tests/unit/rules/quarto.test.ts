import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';

const FM = '---\ntitle: "T"\nformat: html\n---\n\n';
const chunk = (body: string, opts = ''): string => `\`\`\`{r}\n${opts}${body}\n\`\`\`\n`;

describe('quarto rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('quarto-options', () => {
    it('reports R chunks with no options and no execute block', async () => {
      createFile(dir, 'a.qmd', FM + chunk('x <- 1'));
      const f = (await findingsFor(dir, 'quarto')).find((x) => x.id === 'quarto-options');
      expect(f).toBeDefined();
      expect(f!.severity).toBe('recommended');
      expect(f!.category).toBe('structure');
      expect(f!.message.length).toBeGreaterThan(0);
      expect(f!.suggestions!.length).toBeGreaterThan(0);
    });

    it('is satisfied by a #| option line', async () => {
      createFile(dir, 'a.qmd', FM + chunk('x <- 1', '#| echo: false\n'));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-options');
    });

    it('is satisfied by execute: in the qmd YAML', async () => {
      createFile(dir, 'a.qmd', '---\ntitle: T\nexecute:\n  echo: false\n---\n' + chunk('x <- 1'));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-options');
    });

    it('is satisfied by execute: in _quarto.yml', async () => {
      createFile(dir, '_quarto.yml', 'project:\n  type: default\nexecute:\n  warning: false\n');
      createFile(dir, 'a.qmd', FM + chunk('x <- 1'));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-options');
    });

    it.each([
      ['no chunks at all', FM + 'Just prose.\n'],
      ['only a python chunk', FM + '```{python}\nx = 1\n```\n'],
      ['an R chunk shown inside a verbatim fence', FM + '````\n```{r}\nx <- 1\n```\n````\n'],
    ])('does not fire for %s', async (_n, content) => {
      createFile(dir, 'a.qmd', content);
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-options');
    });

    it('handles CRLF files with options', async () => {
      createFile(dir, 'a.qmd', (FM + chunk('x <- 1', '#| echo: false\n')).replace(/\n/g, '\r\n'));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-options');
    });
  });

  describe('quarto-caching', () => {
    const three = FM + chunk('a <- 1') + chunk('b <- 2') + chunk('c <- 3');

    it('reports three chunks without cache or freeze', async () => {
      createFile(dir, 'a.qmd', three);
      const f = (await findingsFor(dir, 'quarto')).find((x) => x.id === 'quarto-caching');
      expect(f).toBeDefined();
      expect(f!.severity).toBe('recommended');
      expect(f!.category).toBe('performance');
      expect(f!.message.length).toBeGreaterThan(0);
      expect(f!.suggestions!.length).toBeGreaterThan(0);
    });

    it('does not fire below three chunks', async () => {
      createFile(dir, 'a.qmd', FM + chunk('a <- 1') + chunk('b <- 2'));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-caching');
    });

    it('counts chunks across files', async () => {
      createFile(dir, 'a.qmd', FM + chunk('a <- 1') + chunk('b <- 2'));
      createFile(dir, 'b.qmd', FM + chunk('c <- 3'));
      expect(await idsFor(dir, 'quarto')).toContain('quarto-caching');
    });

    it('is satisfied by freeze in _quarto.yml', async () => {
      createFile(dir, '_quarto.yml', 'execute:\n  freeze: auto\n');
      createFile(dir, 'a.qmd', three);
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-caching');
    });

    it('is satisfied by cache in the qmd YAML', async () => {
      createFile(dir, 'a.qmd', '---\ntitle: T\nexecute:\n  cache: true\n---\n' + three);
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-caching');
    });

    it('is satisfied by a cache chunk option', async () => {
      createFile(
        dir,
        'a.qmd',
        FM + chunk('a <- 1', '#| cache: true\n') + chunk('b <- 2') + chunk('c <- 3')
      );
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-caching');
    });
  });

  describe('quarto-text', () => {
    it('reports a file with two chunks and no prose', async () => {
      createFile(dir, 'a.qmd', FM + '## Heading\n\n' + chunk('a <- 1') + chunk('b <- 2'));
      const f = (await findingsFor(dir, 'quarto')).find((x) => x.id === 'quarto-text');
      expect(f).toBeDefined();
      expect(f!.severity).toBe('recommended');
      expect(f!.category).toBe('documentation');
      expect(f!.message).toContain('a.qmd');
      expect(f!.suggestions!.length).toBeGreaterThan(0);
    });

    it('does not fire with three narrative lines', async () => {
      createFile(
        dir,
        'a.qmd',
        FM + 'One.\n\n' + chunk('a <- 1') + 'Two.\n\nThree.\n\n' + chunk('b <- 2')
      );
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-text');
    });

    it('fires with two narrative lines (just under the threshold)', async () => {
      createFile(dir, 'a.qmd', FM + 'One.\n\nTwo.\n\n' + chunk('a <- 1') + chunk('b <- 2'));
      expect(await idsFor(dir, 'quarto')).toContain('quarto-text');
    });

    it.each([
      ['a single chunk', FM + chunk('a <- 1')],
      ['an empty file', ''],
      ['prose only', FM + 'a\nb\nc\nd\n'],
    ])('does not fire for %s', async (_n, content) => {
      createFile(dir, 'a.qmd', content);
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-text');
    });

    it('handles CRLF with enough prose', async () => {
      const text = FM + 'A.\n\nB.\n\nC.\n\n' + chunk('a <- 1') + chunk('b <- 2');
      createFile(dir, 'a.qmd', text.replace(/\n/g, '\r\n'));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-text');
    });
  });

  describe('quarto-figures', () => {
    it.each(['ggplot(d, aes(x, y)) + geom_point()', 'plot(cars)', 'hist(x)', 'boxplot(y ~ g)'])(
      'reports %s without fig-cap with file and line',
      async (code) => {
        createFile(dir, 'a.qmd', FM + chunk(code));
        const f = (await findingsFor(dir, 'quarto')).find((x) => x.id === 'quarto-figures');
        expect(f).toBeDefined();
        expect(f!.severity).toBe('recommended');
        expect(f!.category).toBe('documentation');
        expect(f!.file).toContain('a.qmd');
        expect(f!.line).toBe(6);
        expect(f!.message.length).toBeGreaterThan(0);
        expect(f!.suggestions!.length).toBeGreaterThan(0);
      }
    );

    it('is satisfied by fig-cap', async () => {
      createFile(dir, 'a.qmd', FM + chunk('plot(cars)', '#| fig-cap: "Cars"\n'));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-figures');
    });

    it.each([
      ['plot( in a comment', '# plot(cars)\nx <- 1'],
      ['plot( in a string', 'msg <- "call plot(cars)"'],
      ['a longer function name', 'plot_data(cars)'],
      ['autoplot', 'autoplot(fit)'],
    ])('does not fire for %s', async (_n, code) => {
      createFile(dir, 'a.qmd', FM + chunk(code));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-figures');
    });

    it('ignores chunks with eval: false', async () => {
      createFile(dir, 'a.qmd', FM + chunk('plot(cars)', '#| eval: false\n'));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-figures');
    });

    it('handles CRLF', async () => {
      const text = FM + chunk('plot(cars)', '#| fig-cap: "Cars"\n');
      createFile(dir, 'a.qmd', text.replace(/\n/g, '\r\n'));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-figures');
    });
  });

  describe('quarto-tables', () => {
    it.each(['knitr::kable(head(d))', 'kable(d)', 'gt(d)', 'kableExtra::kable_styling(k)'])(
      'reports %s without tbl-cap with file and line',
      async (code) => {
        createFile(dir, 'a.qmd', FM + chunk(code));
        const f = (await findingsFor(dir, 'quarto')).find((x) => x.id === 'quarto-tables');
        expect(f).toBeDefined();
        expect(f!.severity).toBe('recommended');
        expect(f!.category).toBe('structure');
        expect(f!.file).toContain('a.qmd');
        expect(f!.line).toBe(6);
        expect(f!.message.length).toBeGreaterThan(0);
        expect(f!.suggestions!.length).toBeGreaterThan(0);
      }
    );

    it('is satisfied by tbl-cap', async () => {
      createFile(dir, 'a.qmd', FM + chunk('knitr::kable(d)', '#| tbl-cap: "Data"\n'));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-tables');
    });

    it.each([
      ['kable( in a comment', '# kable(d)\nx <- 1'],
      ['gt in a longer name', 'budget(d)'],
      ['a comparison', 'x <- a > b'],
    ])('does not fire for %s', async (_n, code) => {
      createFile(dir, 'a.qmd', FM + chunk(code));
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-tables');
    });
  });
});
