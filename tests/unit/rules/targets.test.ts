import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';

const wrap = (body: string): string => `library(targets)\n\nlist(\n${body}\n)\n`;

describe('targets rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('targets-naming', () => {
    it('reports non-snake_case target names', async () => {
      createFile(
        dir,
        '_targets.R',
        wrap(
          '  tar_target(rawData, read.csv("a.csv")),\n  tar_target(clean_data, f(rawData)),\n  tar_target(Fit.Model, g(clean_data))'
        )
      );
      const finding = (await findingsFor(dir, 'targets')).find((f) => f.id === 'targets-naming');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('recommended');
      expect(finding!.category).toBe('naming');
      expect(finding!.message.length).toBeGreaterThan(0);
      expect(finding!.suggestions!.length).toBeGreaterThan(0);
      expect(finding!.details).toContain('rawData');
      expect(finding!.details).toContain('Fit.Model');
      expect(finding!.details).not.toContain('clean_data');
      expect(finding!.line).toBe(4);
    });

    it('handles the name = argument form', async () => {
      createFile(dir, '_targets.R', wrap('  tar_target(name = fitModel, command = lm(y ~ x))'));
      expect(await idsFor(dir, 'targets')).toContain('targets-naming');
    });

    it('checks R/*.R files as well', async () => {
      createFile(dir, '_targets.R', wrap('  tar_target(ok_name, 1)'));
      createFile(dir, 'R/targets_extra.R', 'extra <- list(tar_target(BadName, 2))\n');
      expect(await idsFor(dir, 'targets')).toContain('targets-naming');
    });

    it('accepts snake_case names, including digits', async () => {
      createFile(
        dir,
        '_targets.R',
        wrap(
          '  tar_target(raw_data, 1),\n  tar_target(name = model_2, command = 2),\n  tar_target(x, 3)'
        )
      );
      expect(await idsFor(dir, 'targets')).not.toContain('targets-naming');
    });

    it.each([
      ['a comment', '# tar_target(BadName, 1)\n  tar_target(good_name, 1)'],
      ['a named command first', '  tar_target(command = 1, name = good_name)'],
      ['another function', '  tar_target_raw("x", quote(1)),\n  my_tar_target(BadName, 1)'],
    ])('does not flag %s', async (_label, body) => {
      createFile(dir, '_targets.R', wrap(body));
      expect(await idsFor(dir, 'targets')).not.toContain('targets-naming');
    });

    it('handles CRLF line endings', async () => {
      createFile(
        dir,
        '_targets.R',
        wrap('  tar_target(good_name, 1),\n  tar_target(BadName, 2)').replace(/\n/g, '\r\n')
      );
      const finding = (await findingsFor(dir, 'targets')).find((f) => f.id === 'targets-naming');
      expect(finding!.details).toContain('BadName');
      expect(finding!.details).not.toContain('good_name');
    });

    it('is silent when there is no targets file', async () => {
      expect(await idsFor(dir, 'targets')).not.toContain('targets-naming');
    });

    it('lists at most 5 distinct names', async () => {
      const body = Array.from({ length: 8 }, (_, i) => `  tar_target(badName${i}, ${i})`).join(
        ',\n'
      );
      createFile(dir, '_targets.R', wrap(body));
      const finding = (await findingsFor(dir, 'targets')).find((f) => f.id === 'targets-naming');
      expect(finding!.details!.match(/badName\d/g)).toHaveLength(5);
    });
  });
});
