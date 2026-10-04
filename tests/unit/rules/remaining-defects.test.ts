import fs from 'fs';
import path from 'path';
import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';
import { Validator } from '../../../src/engine/validator';
import { Finding } from '../../../src/types/finding';
import { Workflow } from '../../../src/types/workflow';

const fm = (body: string): string => `---\ntitle: "B"\n${body}\n---\n\nText\n`;
const filler = (n: number): string =>
  Array.from({ length: n }, (_, i) => `x${i} <- ${i}`).join('\n');

describe('remaining rule defects', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  const find = async (id: string, wf: Workflow): Promise<Finding | undefined> =>
    (await findingsFor(dir, wf)).find((f) => f.id === id);

  describe('bookdown-output-formats', () => {
    it('flags site: bookdown_site plus a single output format', async () => {
      createFile(dir, 'index.Rmd', fm('site: bookdown::bookdown_site\noutput: bookdown::gitbook'));
      const f = await find('bookdown-output-formats', 'bookdown');
      expect(f).toBeDefined();
      expect(f?.suggestions?.length).toBeGreaterThan(0);
    });
    it('is clean with two real formats', async () => {
      createFile(
        dir,
        'index.Rmd',
        fm(
          'site: bookdown::bookdown_site\noutput:\n  bookdown::gitbook: default\n  bookdown::pdf_book: default'
        )
      );
      expect(await idsFor(dir, 'bookdown')).not.toContain('bookdown-output-formats');
    });
    it('is clean with _output.yml', async () => {
      createFile(dir, 'index.Rmd', fm('site: bookdown::bookdown_site'));
      createFile(dir, '_output.yml', 'bookdown::gitbook: default\n');
      expect(await idsFor(dir, 'bookdown')).not.toContain('bookdown-output-formats');
    });
  });

  describe('blogdown-config', () => {
    it.each(['config.json', 'hugo.json'])('accepts %s', async (name) => {
      createFile(dir, name, '{"title": "x"}');
      expect(await idsFor(dir, 'blogdown')).not.toContain('blogdown-config');
    });
    it('still flags a missing config', async () => {
      expect(await idsFor(dir, 'blogdown')).toContain('blogdown-config');
    });
  });

  describe('rscript-header', () => {
    it('is deterministic: reports the first script (sorted) lacking a header', async () => {
      createFile(dir, 'b.R', 'x <- 1\n');
      createFile(dir, 'a.R', 'y <- 1\n');
      createFile(dir, 'c.R', '# ok\nz <- 1\n');
      const all = (await findingsFor(dir, 'r-script')).filter((x) => x.id === 'rscript-header');
      expect(all).toHaveLength(1);
      expect(path.basename(all[0].file ?? '')).toBe('a.R');
    });
    it('examines lowercase .r scripts', async () => {
      createFile(dir, 'a.R', '# header\n');
      createFile(dir, 'b.r', 'x <- 1\n');
      const f = await find('rscript-header', 'r-script');
      expect(path.basename(f?.file ?? '')).toBe('b.r');
    });
    it('accepts a header after a UTF-8 BOM', async () => {
      createFile(dir, 'a.R', '﻿# Purpose: demo\nx <- 1\n');
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-header');
    });
  });

  describe('rscript-functions', () => {
    it.each([
      ['<-', 'f <- function(x) x + 1'],
      ['=', 'f = function(x) x + 1'],
      ['lambda', 'f <- \\(x) x + 1'],
    ])('project validation accepts a function assigned with %s', async (_n, def) => {
      createFile(dir, 'a.R', `# h\n${def}\n${filler(60)}\n`);
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-functions');
    });
    it.each(['f = function(x) x + 1', 'f <- \\(x) x + 1'])(
      'validate_file accepts %s',
      async (def) => {
        const file = createFile(dir, 'a.R', `# h\n${def}\n${filler(60)}\n`);
        const found = await new Validator().validateFile(file);
        expect(found.map((x) => x.id)).not.toContain('rscript-functions');
      }
    );
    it('project validation flags a long script without functions (one finding)', async () => {
      createFile(dir, 'b.R', `# h\n${filler(60)}\n`);
      createFile(dir, 'a.R', `# h\n${filler(70)}\n`);
      const all = (await findingsFor(dir, 'r-script')).filter((x) => x.id === 'rscript-functions');
      expect(all).toHaveLength(1);
      expect(path.basename(all[0].file ?? '')).toBe('a.R');
      expect(all[0].severity).toBe('important');
      expect(all[0].category).toBe('structure');
      expect(all[0].suggestions?.length).toBeGreaterThan(0);
    });
    it('ignores function text in comments and strings', async () => {
      createFile(dir, 'a.R', `# f <- function(x) x\ns <- "g <- function(x) x"\n${filler(60)}\n`);
      expect(await idsFor(dir, 'r-script')).toContain('rscript-functions');
    });
    it('does not flag short scripts', async () => {
      createFile(dir, 'a.R', `# h\n${filler(20)}\n`);
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-functions');
    });
  });

  describe('targets-structure', () => {
    it('is not satisfied by list( in a comment', async () => {
      createFile(dir, '_targets.R', '# list(tar_target(a, 1))\nlibrary(targets)\n');
      expect(await idsFor(dir, 'targets')).toContain('targets-structure');
    });
    it('accepts tar_plan()', async () => {
      createFile(
        dir,
        '_targets.R',
        'library(targets)\nlibrary(tarchetypes)\ntar_plan(tar_target(a, 1))\n'
      );
      expect(await idsFor(dir, 'targets')).not.toContain('targets-structure');
    });
    it('accepts list()', async () => {
      createFile(dir, '_targets.R', 'library(targets)\nlist(tar_target(a, 1))\n');
      expect(await idsFor(dir, 'targets')).not.toContain('targets-structure');
    });
  });

  describe('bookdown-readme', () => {
    it('accepts README.Rmd', async () => {
      createFile(dir, 'index.Rmd', fm('site: bookdown::bookdown_site'));
      createFile(dir, 'README.Rmd', '# Book\n');
      expect(await idsFor(dir, 'bookdown')).not.toContain('bookdown-readme');
    });
    it('flags a missing README', async () => {
      createFile(dir, 'index.Rmd', fm('site: bookdown::bookdown_site'));
      expect(await idsFor(dir, 'bookdown')).toContain('bookdown-readme');
    });
  });

  describe('quarto-tables', () => {
    const chunk = (code: string): string => `${fm('format: html')}\n\`\`\`{r}\n${code}\n\`\`\`\n`;
    const flagged = async (code: string): Promise<boolean> => {
      for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { recursive: true });
      createFile(dir, 'a.qmd', chunk(code));
      return (await idsFor(dir, 'quarto')).includes('quarto-tables');
    };
    it('flags kable() with an unrelated labs(caption =)', async () => {
      expect(await flagged('knitr::kable(df)\nggplot(df) + ggplot2::labs(caption = "src")')).toBe(
        true
      );
      expect(await flagged('knitr::kable(df)\np + labs(title = f(x), caption = "src")')).toBe(true);
    });
    it('accepts caption inside the table call (single and multi line)', async () => {
      expect(await flagged('knitr::kable(df, caption = "x")')).toBe(false);
      expect(await flagged('knitr::kable(\n  df,\n  caption = "x"\n)')).toBe(false);
      expect(await flagged('p + labs(caption = "a")\nknitr::kable(df, caption = "x")')).toBe(false);
    });
    it('still accepts tbl-cap', async () => {
      createFile(
        dir,
        'a.qmd',
        `${fm('format: html')}\n\`\`\`{r}\n#| tbl-cap: "T"\nknitr::kable(df)\n\`\`\`\n`
      );
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-tables');
    });
  });
});
