import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { idsFor } from '../../fixtures/rules';

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
});
