import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from '../../src/cli/utils';
import { Validator } from '../../src/engine/validator';
import { nodeProjectFs } from '../../src/engine/project-fs-node';

/** Runs the built CLI (dist/bin/cli.js); run `npm run build` first when testing locally. */
const CLI = path.resolve(__dirname, '../../dist/bin/cli.js');

const run = (args: string[], input: string) =>
  spawnSync('node', [CLI, 'validate', '-', ...args], { input, encoding: 'utf-8' });

describe('validate - (one file from stdin)', () => {
  beforeAll(() => {
    if (!fs.existsSync(CLI))
      throw new Error(`${CLI} is missing: run "npm run build" before the tests`);
  });

  it('parseArgs keeps a bare - as an argument instead of an option', () => {
    const parsed = parseArgs(['validate', '-', '--stdin-filename', 'a.qmd']);
    expect(parsed.args).toEqual(['-']);
    expect(parsed.options['stdin-filename']).toBe('a.qmd');
  });

  it('reports findings as file:line lines on stdout and exits 1', () => {
    const result = run(['--stdin-filename', 'demo.qmd'], 'x <- 1\n');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      'demo.qmd:1: [recommended] Quarto document should have YAML frontmatter (quarto-yaml)\n'
    );
  });

  it('exits 0 and prints nothing for a clean file', () => {
    const result = run([], '# header\nf <- function() 1\n');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('prints pure JSON on stdout with --format json', () => {
    const result = run(['--stdin-filename', 'demo.qmd', '--format', 'json'], 'x <- 1\n');
    const data = JSON.parse(result.stdout);
    expect(data.path).toBe('demo.qmd');
    expect(data.findings.map((f: { id: string }) => f.id)).toEqual(['quarto-yaml']);
    expect(data.summary.total).toBe(1);
  });

  it('applies --severity', () => {
    const result = run(['--stdin-filename', 'demo.qmd', '--severity', 'important'], 'x <- 1\n');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('checks nothing for an unknown extension', () => {
    expect(run(['--stdin-filename', 'notes.txt'], 'anything\n').status).toBe(0);
  });
});

describe('Validator.validateContent', () => {
  const validator = new Validator(nodeProjectFs);

  it('picks the checks by file extension and summarizes before filtering', () => {
    const result = validator.validateContent('x.Rmd', 'text\n', { minSeverity: 'critical' });
    expect(result.findings).toEqual([]);
    expect(result.summary.total).toBe(1);
  });

  it('gives the same findings as validating the file on disk', async () => {
    const file = path.resolve(__dirname, '../../examples/example-r-script/analysis.R');
    const content = fs.readFileSync(file, 'utf-8');
    const fromDisk = await validator.validateFile(file);
    expect(validator.validateContent(file, content).findings).toEqual(fromDisk);
  });
});
