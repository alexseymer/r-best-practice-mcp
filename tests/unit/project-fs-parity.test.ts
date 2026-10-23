import fs from 'fs';
import os from 'os';
import path from 'path';
import { Validator } from '../../src/engine/validator';
import { createMemoryProjectFs, nodeProjectFs, ProjectFs } from '../../src/engine/project-fs';
import { Workflow } from '../../src/types/workflow';

/**
 * The validator must report the same findings whether project files come from the server's disk
 * or from an in-memory copy (the browser path). These tests run every workflow over real example
 * projects and a synthetic one through both file systems and compare the results.
 */

const WORKFLOWS: Workflow[] = [
  'r-script',
  'quarto',
  'shiny',
  'package',
  'rmarkdown',
  'renv',
  'targets',
  'plumber',
  'analysis',
  'bookdown',
  'blogdown',
  'shinytest',
];

const EXAMPLES = path.resolve(__dirname, '../../examples');
const ROOT = '/project';

/** Every file under a directory as relative POSIX path -> text, skipping node_modules. */
function readTree(dir: string, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(out, readTree(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out[rel] = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
  }
  return out;
}

/** Strips the root from every path so findings from the two file systems can be compared. */
function normalise(value: unknown, root: string): unknown {
  if (typeof value === 'string') return value.startsWith(root) ? value.slice(root.length) : value;
  if (Array.isArray(value)) return value.map((v) => normalise(v, root));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'duration' || k === 'timestamp') continue;
      out[k] = normalise(v, root);
    }
    return out;
  }
  return value;
}

async function validateWith(fsys: ProjectFs, dir: string, workflow: Workflow): Promise<unknown> {
  const result = await new Validator(fsys).validateProject(dir, workflow);
  return normalise(result, dir);
}

const projects: Array<{ name: string; files: Record<string, string> }> = [
  ...fs.readdirSync(EXAMPLES).map((name) => ({
    name,
    files: readTree(path.join(EXAMPLES, name)),
  })),
  {
    name: 'synthetic-mixed',
    files: {
      DESCRIPTION: 'Package: demo\nVersion: 0.1.0\nTitle: Demo\n',
      'R/analysis.R': "x <- 1\n#' Not a roxygen block\nmean2 <- function(v) mean(v)\n",
      'R/nested/inner.r': 'y <- 2\n',
      'Rmd/report.Rmd': '---\ntitle: t\n---\n\n```{r}\nz <- 3\n```\n',
      'app.R': 'library(shiny)\n',
      'ui.R': 'ui <- fluidPage()\n',
      '.hidden/secret.R': 'stop("hidden")\n',
      'node_modules/pkg/index.js': 'module.exports = 1;\n',
      'README.md': '# Demo\n',
      'renv.lock': '{"Packages": {}}\n',
      '_quarto.yml': 'project:\n  type: website\n',
      'index.qmd': '---\ntitle: Home\n---\n\nHello\n',
      'config.toml': 'baseURL = "https://example.org"\n',
    },
  },
];

describe('validator parity: server disk vs in-memory project files', () => {
  it('covers the example projects and a synthetic one', () => {
    expect(projects.length).toBeGreaterThanOrEqual(6);
  });

  for (const project of projects) {
    describe(project.name, () => {
      // Copied to a temp folder outside any git repository. The analysis rule also looks in parent
      // folders for .git; the server can see them, a browser upload cannot (see CHANGELOG).
      let tmp = '';
      beforeAll(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rbp-parity-'));
        for (const [rel, text] of Object.entries(project.files)) {
          const full = path.join(tmp, rel);
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.writeFileSync(full, text, 'utf-8');
        }
      });
      afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

      for (const workflow of WORKFLOWS) {
        it(`${workflow} produces the same findings on disk and in memory`, async () => {
          const memory = createMemoryProjectFs(
            Object.fromEntries(
              Object.entries(project.files).map(([rel, text]) => [`${ROOT}/${rel}`, text])
            )
          );
          const memoryResult = await validateWith(memory, ROOT, workflow);
          const diskResult = await validateWith(nodeProjectFs, tmp, workflow);
          expect(memoryResult).toEqual(diskResult);
        });
      }
    });
  }
});

describe('createMemoryProjectFs', () => {
  const fsys = createMemoryProjectFs({ 'a/b.R': 'x', 'a/c/d.md': 'yy', 'top.txt': 'z' });

  it('lists directories and files', async () => {
    const entries = await fsys.readdir('/');
    expect(entries.map((e) => `${e.name}:${e.isDirectory ? 'd' : 'f'}`).sort()).toEqual([
      'a:d',
      'top.txt:f',
    ]);
  });

  it('reads files and rejects missing paths', async () => {
    expect(await fsys.readFile('/a/c/d.md')).toBe('yy');
    await expect(fsys.readFile('/nope')).rejects.toThrow();
    await expect(fsys.stat('/nope')).rejects.toThrow();
  });

  it('stats files by byte size and directories', async () => {
    expect(await fsys.stat('/top.txt')).toEqual({ isFile: true, isDirectory: false, size: 1 });
    expect((await fsys.stat('/a')).isDirectory).toBe(true);
  });

  it('joins, resolves and relates paths like POSIX', () => {
    expect(fsys.join('/a', '..', 'x', './y')).toBe('/x/y');
    expect(fsys.basename('/a/b.R')).toBe('b.R');
    expect(fsys.dirname('/a/b.R')).toBe('/a');
    expect(fsys.relative('/a/c', '/a/b.R')).toBe('../b.R');
    expect(fsys.resolve('a/b')).toBe('/a/b');
  });
});
