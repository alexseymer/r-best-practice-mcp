import { sanitizeFiles, FILE_LIMITS } from '../../src/check-files';

const file = (path: string, content = 'x') => ({ path, content });

describe('sanitizeFiles', () => {
  it('accepts relative files and returns a path to content map', () => {
    const result = sanitizeFiles([file('DESCRIPTION', 'Package: x'), file('R/a.R', 'f <- 1')]);
    expect(result).toEqual({ ok: true, files: { DESCRIPTION: 'Package: x', 'R/a.R': 'f <- 1' } });
  });

  it('strips a leading ./', () => {
    const result = sanitizeFiles([file('./R/a.R')]);
    expect(result).toEqual({ ok: true, files: { 'R/a.R': 'x' } });
  });

  it.each([
    ['not an array', 'files'],
    ['an empty array', []],
  ])('rejects %s', (_label, input) => {
    expect(sanitizeFiles(input).ok).toBe(false);
  });

  it.each([
    ['an absolute path', '/etc/passwd'],
    ['a Windows drive', 'C:/Users/me/a.R'],
    ['a parent segment', '../secret.R'],
    ['a nested parent segment', 'R/../../secret.R'],
    ['a backslash', 'R\\a.R'],
    ['a NUL byte', 'R/a\0.R'],
    ['an empty path', '  '],
  ])('rejects %s', (_label, path) => {
    const result = sanitizeFiles([file(path)]);
    expect(result.ok).toBe(false);
  });

  it('rejects a path longer than the limit', () => {
    expect(sanitizeFiles([file('a'.repeat(FILE_LIMITS.maxPathLength + 1))]).ok).toBe(false);
  });

  it('rejects a missing or non-string content', () => {
    expect(sanitizeFiles([{ path: 'a.R' }]).ok).toBe(false);
    expect(sanitizeFiles([{ path: 'a.R', content: 5 }]).ok).toBe(false);
    expect(sanitizeFiles([null]).ok).toBe(false);
  });

  it('rejects duplicate paths, also after normalising ./', () => {
    expect(sanitizeFiles([file('a.R'), file('./a.R')]).ok).toBe(false);
  });

  it('rejects too many files', () => {
    const many = Array.from({ length: FILE_LIMITS.maxFiles + 1 }, (_, i) => file(`f${i}.R`));
    expect(sanitizeFiles(many).ok).toBe(false);
  });

  it('rejects a file over the size limit and counts bytes, not characters', () => {
    expect(sanitizeFiles([file('a.R', 'x'.repeat(FILE_LIMITS.maxFileBytes + 1))]).ok).toBe(false);
    // 3 bytes per character: under the limit in characters, over it in bytes
    const chars = Math.floor(FILE_LIMITS.maxFileBytes / 3) + 1;
    expect(sanitizeFiles([file('a.R', '€'.repeat(chars))]).ok).toBe(false);
  });

  it('rejects files over the total size limit', () => {
    const each = FILE_LIMITS.maxFileBytes;
    const count = Math.ceil(FILE_LIMITS.maxTotalBytes / each) + 1;
    const files = Array.from({ length: count }, (_, i) => file(`f${i}.R`, 'x'.repeat(each)));
    expect(sanitizeFiles(files).ok).toBe(false);
  });
});
