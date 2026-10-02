import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';

const FM = '---\ntitle: "T"\noutput: html_document\n---\n\n';
const crlf = (s: string): string => s.replace(/\n/g, '\r\n');

describe('rmarkdown rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('rmd-chunks', () => {
    it.each(['```{r}', '```{r, echo=FALSE}'])('reports %s with file and line', async (header) => {
      createFile(
        dir,
        'a.Rmd',
        `${FM}\`\`\`{r setup}\nx <- 1\n\`\`\`\n\n${header}\ny <- 2\n\`\`\`\n`
      );
      const f = (await findingsFor(dir, 'rmarkdown')).find((x) => x.id === 'rmd-chunks');
      expect(f).toBeDefined();
      expect(f!.severity).toBe('recommended');
      expect(f!.category).toBe('structure');
      expect(f!.file).toContain('a.Rmd');
      expect(f!.line).toBe(10);
      expect(f!.message.length).toBeGreaterThan(0);
      expect(f!.suggestions!.length).toBeGreaterThan(0);
    });

    it.each([
      '```{r load-data}',
      '```{r load-data, echo=FALSE}',
      '```{r, label="x", echo=FALSE}',
      '```{python}',
    ])('does not fire for %s', async (header) => {
      createFile(dir, 'a.Rmd', `${FM}${header}\nx <- 1\n\`\`\`\n`);
      expect(await idsFor(dir, 'rmarkdown')).not.toContain('rmd-chunks');
    });

    it('accepts a #| label line and CRLF endings', async () => {
      createFile(dir, 'a.Rmd', crlf(`${FM}\`\`\`{r}\n#| label: x\ny <- 1\n\`\`\`\n`));
      expect(await idsFor(dir, 'rmarkdown')).not.toContain('rmd-chunks');
    });

    it('ignores chunk-like text inside a longer fence and empty files', async () => {
      createFile(dir, 'a.Rmd', `${FM}\`\`\`\`\n\`\`\`{r}\n\`\`\`\n\`\`\`\`\n`);
      createFile(dir, 'b.Rmd', '');
      expect(await idsFor(dir, 'rmarkdown')).not.toContain('rmd-chunks');
    });
  });

  describe('rmd-chunk-options', () => {
    it('reports R chunks with only default options', async () => {
      createFile(dir, 'a.Rmd', `${FM}\`\`\`{r a}\nx <- 1\n\`\`\`\n`);
      const f = (await findingsFor(dir, 'rmarkdown')).find((x) => x.id === 'rmd-chunk-options');
      expect(f).toBeDefined();
      expect(f!.severity).toBe('recommended');
      expect(f!.category).toBe('structure');
      expect(f!.message.length).toBeGreaterThan(0);
      expect(f!.suggestions!.length).toBeGreaterThan(0);
    });

    it.each([
      ['opts_chunk$set', '```{r setup}\nknitr::opts_chunk$set(echo = FALSE)\n```\n'],
      ['echo in a header', '```{r a, echo=FALSE}\nx <- 1\n```\n'],
      ['include in a header', '```{r a, include=FALSE}\nx <- 1\n```\n'],
      ['fig.width in a header', '```{r a, fig.width=5}\nx <- 1\n```\n'],
      ['a #| option', '```{r a}\n#| warning: false\nx <- 1\n```\n'],
    ])('is satisfied by %s', async (_n, body) => {
      createFile(dir, 'a.Rmd', FM + body);
      expect(await idsFor(dir, 'rmarkdown')).not.toContain('rmd-chunk-options');
    });

    it('is satisfied by opts_chunk$set in a sourced R script', async () => {
      createFile(dir, 'setup.R', 'knitr::opts_chunk$set(echo = FALSE)\n');
      createFile(dir, 'a.Rmd', `${FM}\`\`\`{r a}\nx <- 1\n\`\`\`\n`);
      expect(await idsFor(dir, 'rmarkdown')).not.toContain('rmd-chunk-options');
    });

    it('does not fire for prose mentioning options when there are no chunks', async () => {
      createFile(dir, 'a.Rmd', `${FM}Prose mentioning echo = FALSE only.\n`);
      expect(await idsFor(dir, 'rmarkdown')).not.toContain('rmd-chunk-options');
    });

    it('handles CRLF', async () => {
      createFile(dir, 'a.Rmd', crlf(`${FM}\`\`\`{r a, echo=FALSE}\nx <- 1\n\`\`\`\n`));
      expect(await idsFor(dir, 'rmarkdown')).not.toContain('rmd-chunk-options');
    });
  });
});
