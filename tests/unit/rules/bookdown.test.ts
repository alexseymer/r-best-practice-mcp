import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';

const INDEX = '---\ntitle: "Book"\nsite: bookdown::bookdown_site\n---\n\n# Preface\n';

describe('bookdown rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('bookdown-chapter-naming', () => {
    it('reports badly named chapters', async () => {
      createFile(dir, 'index.Rmd', INDEX);
      createFile(dir, 'Intro.Rmd', '# Intro\n');
      createFile(dir, '01-ok.Rmd', '# Ok\n');
      const f = (await findingsFor(dir, 'bookdown')).find(
        (x) => x.id === 'bookdown-chapter-naming'
      );
      expect(f).toBeDefined();
      expect(f!.severity).toBe('recommended');
      expect(f!.category).toBe('naming');
      expect(f!.details).toContain('Intro.Rmd');
      expect(f!.details).not.toContain('01-ok.Rmd');
      expect(f!.message.length).toBeGreaterThan(0);
      expect(f!.suggestions!.length).toBeGreaterThan(0);
    });

    it('lists at most 5 names', async () => {
      for (let i = 0; i < 8; i++) createFile(dir, `Bad${i}.Rmd`, '# x\n');
      const f = (await findingsFor(dir, 'bookdown')).find(
        (x) => x.id === 'bookdown-chapter-naming'
      );
      expect(f!.details!.match(/Bad\d\.Rmd/g)).toHaveLength(5);
    });

    it.each(['01-intro.Rmd', '12-data-prep-2.Rmd'])('accepts %s', async (name) => {
      createFile(dir, 'index.Rmd', INDEX);
      createFile(dir, name, '# x\n');
      expect(await idsFor(dir, 'bookdown')).not.toContain('bookdown-chapter-naming');
    });

    it.each(['1-intro.Rmd', '01_intro.Rmd', '01-Intro.Rmd', '001-intro.Rmd'])(
      'rejects %s',
      async (name) => {
        createFile(dir, 'index.Rmd', INDEX);
        createFile(dir, name, '# x\n');
        expect(await idsFor(dir, 'bookdown')).toContain('bookdown-chapter-naming');
      }
    );

    it('ignores index.Rmd, README.Rmd, underscore files and subdirectories', async () => {
      createFile(dir, 'index.Rmd', INDEX);
      createFile(dir, 'README.Rmd', '# r\n');
      createFile(dir, '_draft.Rmd', '# d\n');
      createFile(dir, 'extra/Notes.Rmd', '# n\n');
      expect(await idsFor(dir, 'bookdown')).not.toContain('bookdown-chapter-naming');
    });
  });

  describe('bookdown-output-formats', () => {
    it('reports an index with one format and no _output.yml', async () => {
      createFile(dir, 'index.Rmd', '---\ntitle: B\noutput: bookdown::gitbook\n---\n');
      const f = (await findingsFor(dir, 'bookdown')).find(
        (x) => x.id === 'bookdown-output-formats'
      );
      expect(f).toBeDefined();
      expect(f!.severity).toBe('recommended');
      expect(f!.category).toBe('structure');
      expect(f!.message.length).toBeGreaterThan(0);
      expect(f!.suggestions!.length).toBeGreaterThan(0);
    });

    it('reports an index with no format at all', async () => {
      createFile(dir, 'index.Rmd', INDEX);
      expect(await idsFor(dir, 'bookdown')).toContain('bookdown-output-formats');
    });

    it('is satisfied by _output.yml', async () => {
      createFile(dir, 'index.Rmd', INDEX);
      createFile(dir, '_output.yml', 'bookdown::gitbook: default\n');
      expect(await idsFor(dir, 'bookdown')).not.toContain('bookdown-output-formats');
    });

    it('is satisfied by two distinct formats in the index YAML (CRLF)', async () => {
      const yaml =
        '---\ntitle: B\noutput:\n  bookdown::gitbook: default\n  bookdown::pdf_book: default\n---\n';
      createFile(dir, 'index.Rmd', yaml.replace(/\n/g, '\r\n'));
      expect(await idsFor(dir, 'bookdown')).not.toContain('bookdown-output-formats');
    });

    it('does not count the same format twice', async () => {
      createFile(
        dir,
        'index.Rmd',
        '---\noutput:\n  bookdown::gitbook: default\n  bookdown::gitbook: x\n---\n'
      );
      expect(await idsFor(dir, 'bookdown')).toContain('bookdown-output-formats');
    });

    it('stays silent when index.Rmd is missing', async () => {
      createFile(dir, '01-a.Rmd', '# a\n');
      expect(await idsFor(dir, 'bookdown')).not.toContain('bookdown-output-formats');
    });
  });

  describe('bookdown-cross-references', () => {
    const fig = '```{r p, fig.cap="A plot"}\nplot(cars)\n```\n';

    it('reports figures without any \\@ref(', async () => {
      createFile(dir, 'index.Rmd', INDEX);
      createFile(dir, '01-a.Rmd', '# A\n\n' + fig);
      const f = (await findingsFor(dir, 'bookdown')).find(
        (x) => x.id === 'bookdown-cross-references'
      );
      expect(f).toBeDefined();
      expect(f!.severity).toBe('recommended');
      expect(f!.category).toBe('documentation');
      expect(f!.message.length).toBeGreaterThan(0);
      expect(f!.suggestions!.length).toBeGreaterThan(0);
    });

    it.each(['ggplot(d) + geom_point()', 'knitr::kable(d)'])('detects %s', async (code) => {
      createFile(dir, '01-a.Rmd', `# A\n\n\`\`\`{r x}\n${code}\n\`\`\`\n`);
      expect(await idsFor(dir, 'bookdown')).toContain('bookdown-cross-references');
    });

    it('is satisfied by \\@ref( in any Rmd file', async () => {
      createFile(dir, '01-a.Rmd', '# A\n\n' + fig);
      createFile(dir, '02-b.Rmd', 'See Figure \\@ref(fig:p).\n');
      expect(await idsFor(dir, 'bookdown')).not.toContain('bookdown-cross-references');
    });

    it('does not fire without figures or tables, or on plot in a comment', async () => {
      createFile(dir, '01-a.Rmd', '# A\n\n```{r x}\n# plot(cars)\nx <- 1\n```\n');
      createFile(dir, '02-b.Rmd', 'Prose only.\r\n');
      expect(await idsFor(dir, 'bookdown')).not.toContain('bookdown-cross-references');
    });
  });
});
