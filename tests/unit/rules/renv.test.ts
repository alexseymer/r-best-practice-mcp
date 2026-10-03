import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';

describe('renv rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('renv-init', () => {
    it('reports renv.lock without renv/activate.R', async () => {
      createFile(dir, 'renv.lock', '{}\n');
      const f = (await findingsFor(dir, 'renv')).find((x) => x.id === 'renv-init');
      expect(f).toBeDefined();
      expect(f?.severity).toBe('important');
      expect(f?.category).toBe('dependency');
      expect(f?.message).toBeTruthy();
      expect(f?.suggestions?.some((s) => s.includes('renv::init()'))).toBe(true);
    });

    it('is satisfied by renv/activate.R', async () => {
      createFile(dir, 'renv.lock', '{}\n');
      createFile(dir, 'renv/activate.R', '# renv\n');
      expect(await idsFor(dir, 'renv')).not.toContain('renv-init');
    });

    it('stays silent without renv.lock', async () => {
      expect(await idsFor(dir, 'renv')).not.toContain('renv-init');
    });
  });
});
