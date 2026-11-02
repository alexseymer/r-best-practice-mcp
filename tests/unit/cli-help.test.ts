import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Runs the built CLI (dist/bin/cli.js). CI builds before it runs the unit tests, so the build output
 * is present; locally, run `npm run build` first.
 */
const CLI = path.resolve(__dirname, '../../dist/bin/cli.js');

describe('CLI help flags', () => {
  beforeAll(() => {
    if (!fs.existsSync(CLI))
      throw new Error(`${CLI} is missing: run "npm run build" before the tests`);
  });

  it.each(['help', '--help', '-h'])('%s prints the usage and exits 0', (flag) => {
    const out = execFileSync('node', [CLI, flag], { encoding: 'utf-8' });
    expect(out).toMatch(/Commands:/);
    expect(out).not.toMatch(/Unknown command/);
  });

  it('an unknown command still exits with status 1', () => {
    const result = spawnSync('node', [CLI, 'no-such-command'], { encoding: 'utf-8' });
    expect(result.status).toBe(1);
  });
});
