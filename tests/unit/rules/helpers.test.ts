import path from 'path';
import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import {
  DEFAULT_SKIPPED_DIRS,
  MAX_FILES,
  compareNames,
  findFiles,
  maskRSource,
  stripBom,
  stripLineComment,
} from '../../../src/engine/rules/helpers';

const rel = (dir: string, files: string[]): string[] =>
  files.map((f) => path.relative(dir, f).split(path.sep).join('/'));

describe('rule helpers', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('findFiles', () => {
    const layout = (): void => {
      for (const d of [
        'docs',
        'public',
        'renv',
        '_book',
        '_site',
        'node_modules',
        '.git',
        'keep',
      ]) {
        createFile(dir, `${d}/a.md`, 'x');
      }
      createFile(dir, 'top.md', 'x');
      createFile(dir, '.hidden.md', 'x');
    };

    it('skips the default directories at any depth, and hidden files', async () => {
      layout();
      createFile(dir, 'content/docs/nested.md', 'x');
      expect(rel(dir, await findFiles(dir, /\.md$/))).toEqual(['keep/a.md', 'top.md']);
    });

    it('exports the default skip list', () => {
      expect([...DEFAULT_SKIPPED_DIRS].sort()).toEqual(
        ['.git', '_book', '_site', 'docs', 'node_modules', 'public', 'renv'].sort()
      );
    });

    it('skipDirs replaces the default list', async () => {
      layout();
      createFile(dir, 'content/docs/nested.md', 'x');
      const files = rel(dir, await findFiles(dir, /\.md$/, { skipDirs: ['node_modules', '.git'] }));
      expect(files).toEqual([
        '_book/a.md',
        '_site/a.md',
        'content/docs/nested.md',
        'docs/a.md',
        'keep/a.md',
        'public/a.md',
        'renv/a.md',
        'top.md',
      ]);
    });

    it('an empty skipDirs list skips nothing but hidden entries', async () => {
      layout();
      const files = rel(dir, await findFiles(dir, /\.md$/, { skipDirs: [] }));
      expect(files).toContain('docs/a.md');
      expect(files).toContain('node_modules/a.md');
      expect(files).not.toContain('.git/a.md');
      expect(files).not.toContain('.hidden.md');
    });

    it('includeHidden still honours skipDirs', async () => {
      layout();
      const files = rel(
        dir,
        await findFiles(dir, /\.md$/, { includeHidden: true, skipDirs: ['node_modules'] })
      );
      expect(files).toContain('.git/a.md');
      expect(files).toContain('.hidden.md');
      expect(files).not.toContain('node_modules/a.md');
    });

    it('recursive: false lists only the top level', async () => {
      createFile(dir, 'a.md', 'x');
      createFile(dir, 'sub/b.md', 'x');
      expect(rel(dir, await findFiles(dir, /\.md$/, { recursive: false }))).toEqual(['a.md']);
    });

    it('returns an empty list for a missing directory', async () => {
      expect(await findFiles(path.join(dir, 'nope'), /./)).toEqual([]);
    });

    it('orders names locale-independently (code unit order)', async () => {
      for (const n of ['b.md', 'B.md', 'a.md', 'A.md', '_x.md', '10.md', '9.md']) {
        createFile(dir, n, 'x');
      }
      expect(rel(dir, await findFiles(dir, /\.md$/))).toEqual([
        '10.md',
        '9.md',
        'A.md',
        'B.md',
        '_x.md',
        'a.md',
        'b.md',
      ]);
    });

    it('caps the result at MAX_FILES and returns the first files in sorted order', async () => {
      expect(MAX_FILES).toBe(200);
      for (let i = 0; i < 250; i++) createFile(dir, `f${String(i).padStart(3, '0')}.md`, 'x');
      const files = rel(dir, await findFiles(dir, /\.md$/));
      expect(files).toHaveLength(200);
      expect(files[0]).toBe('f000.md');
      expect(files[199]).toBe('f199.md');
      expect(files).toEqual([...files].sort());
    });

    it('caps across subdirectories deterministically', async () => {
      for (let i = 0; i < 150; i++) createFile(dir, `a/f${String(i).padStart(3, '0')}.md`, 'x');
      for (let i = 0; i < 150; i++) createFile(dir, `b/f${String(i).padStart(3, '0')}.md`, 'x');
      const files = rel(dir, await findFiles(dir, /\.md$/));
      expect(files).toHaveLength(200);
      expect(files.filter((f) => f.startsWith('a/'))).toHaveLength(150);
      expect(files.filter((f) => f.startsWith('b/'))).toHaveLength(50);
    });
  });

  describe('compareNames', () => {
    it.each([
      ['a', 'b', -1],
      ['b', 'a', 1],
      ['a', 'a', 0],
      ['B', 'a', -1],
      ['Z', '_', -1],
    ])('compareNames(%s, %s) = %i', (a, b, expected) => {
      expect(compareNames(a, b)).toBe(expected);
    });
  });

  describe('stripBom', () => {
    it('removes only a leading BOM', () => {
      expect(stripBom('﻿abc')).toBe('abc');
      expect(stripBom('abc')).toBe('abc');
      expect(stripBom('a﻿b')).toBe('a﻿b');
      expect(stripBom('')).toBe('');
    });
  });

  describe('stripLineComment / maskRSource', () => {
    it.each([
      ['x <- 1 # note', 'x <- 1'],
      ['# whole line', ''],
      ['x <- "a # b" # c', 'x <- "a # b"'],
      ["x <- 'it\\'s # not' # c", "x <- 'it\\'s # not'"],
      ['x <- `a # b`', 'x <- `a # b`'],
      ['x <- "a\\" # still string" # c', 'x <- "a\\" # still string"'],
      ['no comment', 'no comment'],
      ['x <- 1 # "unterminated', 'x <- 1'],
    ])('stripLineComment(%j) = %j', (line, expected) => {
      expect(stripLineComment(line)).toBe(expected);
    });

    it('keeps length and newlines, handles multi-line strings and CRLF', () => {
      const text = 'a <- "x\n# not comment"\r\nb <- 1 # c\r\n# d\n';
      const masked = maskRSource(text, false);
      expect(masked).toHaveLength(text.length);
      expect(masked.split('\n')).toHaveLength(text.split('\n').length);
      expect(masked).toContain('# not comment');
      expect(masked).not.toContain('# c');
      expect(masked).not.toContain('# d');
    });

    it('blanks string contents but keeps delimiters when maskStrings is true', () => {
      expect(maskRSource('f("abc", \'d\') # x', true)).toBe('f("   ", \' \')    ');
    });

    it('is linear on adversarial input', () => {
      const start = Date.now();
      for (const s of [' #'.repeat(50_000) + '"', '"'.repeat(100_000), '\\'.repeat(100_000)]) {
        maskRSource(s, true);
        stripLineComment(s);
      }
      expect(Date.now() - start).toBeLessThan(2000);
    });
  });
});
