import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';

const DESC = 'Package: demo\nVersion: 0.1.0\n';
const DOCUMENTED = "#' Add one\n#' @export\nf <- function(x) x + 1\n";

describe('package rules (namespace, roxygen, vignettes)', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('pkg-namespace', () => {
    it('reports DESCRIPTION without NAMESPACE', async () => {
      createFile(dir, 'DESCRIPTION', DESC);
      const f = (await findingsFor(dir, 'package')).find((x) => x.id === 'pkg-namespace');
      expect(f).toBeDefined();
      expect(f?.severity).toBe('important');
      expect(f?.category).toBe('structure');
      expect(f?.message).toBeTruthy();
      expect(f?.suggestions?.length).toBeGreaterThan(0);
    });

    it('is satisfied by a NAMESPACE file', async () => {
      createFile(dir, 'DESCRIPTION', DESC);
      createFile(dir, 'NAMESPACE', 'export(f)\n');
      expect(await idsFor(dir, 'package')).not.toContain('pkg-namespace');
    });

    it('stays silent without DESCRIPTION', async () => {
      expect(await idsFor(dir, 'package')).not.toContain('pkg-namespace');
    });
  });

  describe('pkg-roxygen', () => {
    it('reports R files without roxygen comments', async () => {
      createFile(dir, 'DESCRIPTION', DESC);
      createFile(dir, 'R/a.R', '# plain comment\nf <- function(x) x\n');
      const f = (await findingsFor(dir, 'package')).find((x) => x.id === 'pkg-roxygen');
      expect(f).toBeDefined();
      expect(f?.severity).toBe('important');
      expect(f?.category).toBe('documentation');
      expect(f?.message).toBeTruthy();
      expect(f?.suggestions?.length).toBeGreaterThan(0);
    });

    it.each([
      ['LF', DOCUMENTED],
      ['CRLF', DOCUMENTED.replace(/\n/g, '\r\n')],
      ['indented', "  #' Add one\nf <- 1\n"],
    ])('is satisfied by roxygen comments (%s)', async (_n, content) => {
      createFile(dir, 'DESCRIPTION', DESC);
      createFile(dir, 'R/a.R', '# nothing\n');
      createFile(dir, 'R/b.R', content);
      expect(await idsFor(dir, 'package')).not.toContain('pkg-roxygen');
    });

    it('stays silent when R/ is missing or empty', async () => {
      createFile(dir, 'DESCRIPTION', DESC);
      expect(await idsFor(dir, 'package')).not.toContain('pkg-roxygen');
      createFile(dir, 'R/.keep', '');
      expect(await idsFor(dir, 'package')).not.toContain('pkg-roxygen');
    });

    it('does not count a quote inside a string as roxygen', async () => {
      createFile(dir, 'DESCRIPTION', DESC);
      createFile(dir, 'R/a.R', 'x <- "#\' not a comment"\n');
      expect(await idsFor(dir, 'package')).toContain('pkg-roxygen');
    });
  });

  describe('pkg-vignettes', () => {
    const rFiles = (n: number) =>
      Array.from({ length: n }, (_v, i) => createFile(dir, `R/f${i}.R`, DOCUMENTED));

    it('reports 3 R files without vignettes/', async () => {
      createFile(dir, 'DESCRIPTION', DESC);
      rFiles(3);
      const f = (await findingsFor(dir, 'package')).find((x) => x.id === 'pkg-vignettes');
      expect(f).toBeDefined();
      expect(f?.severity).toBe('recommended');
      expect(f?.category).toBe('documentation');
      expect(f?.message).toBeTruthy();
      expect(f?.suggestions?.length).toBeGreaterThan(0);
    });

    it('does not fire just under the threshold (2 R files)', async () => {
      createFile(dir, 'DESCRIPTION', DESC);
      rFiles(2);
      expect(await idsFor(dir, 'package')).not.toContain('pkg-vignettes');
    });

    it('is satisfied by a vignettes/ directory', async () => {
      createFile(dir, 'DESCRIPTION', DESC);
      rFiles(4);
      createFile(dir, 'vignettes/intro.Rmd', '# intro\n');
      expect(await idsFor(dir, 'package')).not.toContain('pkg-vignettes');
    });
  });
});
