import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';

describe('package rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('pkg-readme', () => {
    it('reports a package without a README', async () => {
      createFile(dir, 'DESCRIPTION', 'Package: demo\nVersion: 0.1.0\n');
      expect(await idsFor(dir, 'package')).toContain('pkg-readme');
    });

    it.each(['README.md', 'README.Rmd'])('is satisfied by %s', async (name) => {
      createFile(dir, 'DESCRIPTION', 'Package: demo\nVersion: 0.1.0\n');
      createFile(dir, name, '# demo\n');
      expect(await idsFor(dir, 'package')).not.toContain('pkg-readme');
    });
  });

  describe('pkg-library-calls', () => {
    const desc = 'Package: demo\nVersion: 0.1.0\n';
    it.each(['library', 'require'])('reports %s() in R/', async (fn) => {
      createFile(dir, 'DESCRIPTION', desc);
      createFile(dir, 'R/a.R', `f <- function() 1\n${fn}(dplyr)\n`);
      const finding = (await findingsFor(dir, 'package')).find((f) => f.id === 'pkg-library-calls');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('recommended');
      expect(finding!.category).toBe('dependency');
      expect(finding!.message).toMatch(/^Consider/);
      expect(finding!.line).toBe(2);
    });

    it.each([
      ['requireNamespace', 'if (requireNamespace("x", quietly = TRUE)) 1'],
      ['pkg::fun', 'x <- dplyr::filter(df, a)'],
      ['comment', '# library(dplyr)\nx <- 1'],
      ['string', 'msg <- "call library(x) first"'],
      ['roxygen', "#' @examples\n#' library(demo)\nx <- 1"],
      ['method name', 'x <- obj$library(1)'],
    ])('does not report %s', async (_label, body) => {
      createFile(dir, 'DESCRIPTION', desc);
      createFile(dir, 'R/a.R', `${body}\n`);
      expect(await idsFor(dir, 'package')).not.toContain('pkg-library-calls');
    });

    it('ignores scripts outside R/', async () => {
      createFile(dir, 'DESCRIPTION', desc);
      createFile(dir, 'data-raw/prep.R', 'library(dplyr)\n');
      expect(await idsFor(dir, 'package')).not.toContain('pkg-library-calls');
    });
  });

  describe('pkg-rbuildignore', () => {
    const desc = 'Package: demo\nVersion: 0.1.0\n';
    it('reports dev files without .Rbuildignore', async () => {
      createFile(dir, 'DESCRIPTION', desc);
      createFile(dir, 'demo.Rproj', 'Version: 1.0\n');
      expect(await idsFor(dir, 'package')).toContain('pkg-rbuildignore');
    });

    it('reports a .github directory', async () => {
      createFile(dir, 'DESCRIPTION', desc);
      createFile(dir, '.github/workflows/check.yaml', 'name: check\n');
      expect(await idsFor(dir, 'package')).toContain('pkg-rbuildignore');
    });

    it('is satisfied by .Rbuildignore', async () => {
      createFile(dir, 'DESCRIPTION', desc);
      createFile(dir, 'demo.Rproj', 'Version: 1.0\n');
      createFile(dir, '.Rbuildignore', '^.*\\.Rproj$\n');
      expect(await idsFor(dir, 'package')).not.toContain('pkg-rbuildignore');
    });

    it('does not report a package without dev files', async () => {
      createFile(dir, 'DESCRIPTION', desc);
      expect(await idsFor(dir, 'package')).not.toContain('pkg-rbuildignore');
    });

    it('does not run without DESCRIPTION', async () => {
      createFile(dir, 'demo.Rproj', 'Version: 1.0\n');
      expect(await idsFor(dir, 'package')).not.toContain('pkg-rbuildignore');
    });
  });
});
