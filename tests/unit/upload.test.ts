import fs from 'fs';
import os from 'os';
import path from 'path';
import { UPLOAD_LIMITS } from '../../src/config/runtime';
import {
  MAX_UPLOAD_DEPTH,
  sanitizeUpload,
  stripDirPrefix,
  UploadError,
  UploadGate,
  UploadLimits,
  withUploadedProject,
} from '../../src/engine/upload';

const f = (p: unknown, content: unknown = 'x') => ({ path: p, content });
const upload = (...files: unknown[]) => ({ files });

function failure(body: unknown, limits: UploadLimits = UPLOAD_LIMITS): UploadError {
  try {
    sanitizeUpload(body, limits);
  } catch (e) {
    expect(e).toBeInstanceOf(UploadError);
    return e as UploadError;
  }
  throw new Error('expected sanitizeUpload to throw');
}

const tempDirs = (): string[] =>
  fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('rbp-upload-'));

describe('sanitizeUpload', () => {
  it('accepts allowed files and normalises backslashes', () => {
    const r = sanitizeUpload(upload(f('R\\utils.R', 'a <- 1\n'), f('DESCRIPTION', 'Package: x\n')));
    expect(r.files.map((x) => x.path)).toEqual(['R/utils.R', 'DESCRIPTION']);
    expect(r.bytes).toBe(Buffer.byteLength('a <- 1\n') + Buffer.byteLength('Package: x\n'));
    expect(r.skipped).toBe(0);
  });

  it('accepts special names and any extension case', () => {
    const names = ['renv.lock', '_targets.R', '.Rprofile', 'NAMESPACE', 'a/B.RMD', '.github/x.yml'];
    expect(sanitizeUpload(upload(...names.map((n) => f(n)))).files).toHaveLength(names.length);
  });

  it('skips disallowed files and counts them', () => {
    const r = sanitizeUpload(upload(f('a.R'), f('logo.png', 'binary'), f('b.exe'), f('noext')));
    expect(r.files.map((x) => x.path)).toEqual(['a.R']);
    expect(r.skipped).toBe(3);
  });

  it('rejects with 400 when nothing supported remains', () => {
    const e = failure(upload(f('logo.png'), f('x.bin')));
    expect(e.status).toBe(400);
    expect(e.code).toBe('INVALID_PARAMETER');
    expect(e.message).toMatch(/no supported files/);
  });

  it.each([
    ['null body', null],
    ['no files', {}],
    ['files not an array', { files: 'a.R' }],
    ['empty array', { files: [] }],
    ['entry not an object', { files: ['a.R'] }],
    ['entry null', { files: [null] }],
    ['entry array', { files: [['a.R', 'x']] }],
  ])('rejects %s', (_n, body) => {
    expect(failure(body).status).toBe(400);
  });

  it.each([
    ['non-string path', f(5)],
    ['missing path', { content: 'x' }],
    ['empty path', f('')],
    ['absolute posix', f('/etc/passwd.txt')],
    ['absolute windows', f('C:\\x\\a.R')],
    ['absolute windows slash', f('c:/x/a.R')],
    ['UNC', f('\\\\server\\share\\a.R')],
    ['parent segment', f('../a.R')],
    ['nested parent', f('R/../../a.R')],
    ['backslash parent', f('R\\..\\..\\a.R')],
    ['dot segment', f('./a.R')],
    ['inner dot segment', f('R/./a.R')],
    ['empty segment', f('R//a.R')],
    ['trailing slash', f('R/')],
    ['NUL', f('a\u0000.R')],
    ['control char', f('a\n.R')],
    ['DEL', f('a\u007f.R')],
    ['too deep', f(Array(MAX_UPLOAD_DEPTH).fill('d').join('/') + '/a.R')],
    ['too long', f('a'.repeat(UPLOAD_LIMITS.maxPathLength) + '.R')],
    ['non-string content', f('a.R', 42)],
    ['missing content', { path: 'a.R' }],
  ])('rejects %s with 400 INVALID_PARAMETER', (_n, entry) => {
    const e = failure(upload(f('ok.R'), entry));
    expect(e.status).toBe(400);
    expect(e.code).toBe('INVALID_PARAMETER');
  });

  it('allows the maximum depth', () => {
    const p =
      Array(MAX_UPLOAD_DEPTH - 1)
        .fill('d')
        .join('/') + '/a.R';
    expect(sanitizeUpload(upload(f(p))).files).toHaveLength(1);
  });

  it('rejects duplicates after normalisation, case-sensitively', () => {
    expect(failure(upload(f('R/a.R'), f('R\\a.R'))).message).toMatch(/duplicates/);
    expect(sanitizeUpload(upload(f('a.R'), f('A.R'))).files).toHaveLength(2);
  });

  it('rejects a path that is both file and directory', () => {
    expect(failure(upload(f('x.md'), f('x.md/a.R'))).status).toBe(400);
  });

  it('rejects bad paths even in files that would be skipped', () => {
    expect(failure(upload(f('a.R'), f('../logo.png'))).status).toBe(400);
  });

  it('enforces limits with 413', () => {
    const limits = { ...UPLOAD_LIMITS, maxFiles: 2, maxFileBytes: 10, maxTotalBytes: 15 };
    expect(failure(upload(f('a.R'), f('b.R'), f('c.R')), limits).status).toBe(413);
    expect(failure(upload(f('a.R', 'x'.repeat(11))), limits)).toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
    expect(failure(upload(f('a.R', 'x'.repeat(10)), f('b.R', 'x'.repeat(6))), limits).status).toBe(
      413
    );
  });

  it('counts bytes, not characters', () => {
    const limits = { ...UPLOAD_LIMITS, maxFileBytes: 4 };
    expect(failure(upload(f('a.R', '\u20ac\u20ac')), limits).status).toBe(413);
  });

  it('does not count skipped files against size limits and never echoes input', () => {
    const limits = { ...UPLOAD_LIMITS, maxFileBytes: 10 };
    expect(sanitizeUpload(upload(f('a.R'), f('big.png', 'x'.repeat(100))), limits).skipped).toBe(1);
    const secret = 'SECRET-'.repeat(20);
    expect(failure(upload(f(`../${secret}.R`))).message).not.toContain('SECRET');
  });
});

describe('withUploadedProject', () => {
  it('writes files, runs fn and removes the directory', async () => {
    const before = tempDirs();
    let seen = '';
    const result = await withUploadedProject(
      [
        { path: 'DESCRIPTION', content: 'Package: x\n' },
        { path: 'R/deep/a.R', content: 'a <- 1\n' },
      ],
      async (dir, created) => {
        seen = dir;
        expect(fs.readFileSync(path.join(dir, 'R/deep/a.R'), 'utf8')).toBe('a <- 1\n');
        expect(path.basename(created)).toMatch(/^rbp-upload-/);
        return 42;
      }
    );
    expect(result).toBe(42);
    expect(fs.existsSync(seen)).toBe(false);
    expect(tempDirs()).toEqual(before);
  });

  it('removes the directory when fn throws', async () => {
    const before = tempDirs();
    let seen = '';
    await expect(
      withUploadedProject([{ path: 'a.R', content: 'x' }], async (dir) => {
        seen = dir;
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(fs.existsSync(seen)).toBe(false);
    expect(tempDirs()).toEqual(before);
  });

  it('removes the directory when writing fails', async () => {
    const before = tempDirs();
    await expect(
      withUploadedProject(
        [
          { path: 'a.R', content: 'x' },
          { path: 'a.R', content: 'y' },
        ],
        async () => 1
      )
    ).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
    await expect(
      withUploadedProject([{ path: '../escape.R', content: 'x' }], async () => 1)
    ).rejects.toBeInstanceOf(UploadError);
    expect(tempDirs()).toEqual(before);
  });

  it('creates private files and directories and no symlinks', async () => {
    await withUploadedProject([{ path: 'R/a.R', content: 'x' }], async (dir) => {
      expect(fs.statSync(dir).mode & 0o077).toBe(0);
      expect(fs.statSync(path.join(dir, 'R')).mode & 0o077).toBe(0);
      expect(fs.statSync(path.join(dir, 'R/a.R')).mode & 0o077).toBe(0);
      expect(fs.lstatSync(path.join(dir, 'R/a.R')).isSymbolicLink()).toBe(false);
    });
  });

  it('writes nothing outside the temp directory', async () => {
    const marker = path.join(os.tmpdir(), 'escape-marker.R');
    fs.rmSync(marker, { force: true });
    await expect(
      withUploadedProject([{ path: '../escape-marker.R', content: 'x' }], async () => 1)
    ).rejects.toBeInstanceOf(UploadError);
    expect(fs.existsSync(marker)).toBe(false);
  });
});

describe('stripDirPrefix', () => {
  it('removes the directory from nested strings', () => {
    const dir = '/tmp/rbp-upload-x';
    const out = stripDirPrefix(
      { file: `${dir}/R/a.R`, message: `see ${dir}/R/a.R and ${dir}`, n: 1, l: [`${dir}/b`] },
      [dir]
    );
    expect(out).toEqual({ file: 'R/a.R', message: 'see R/a.R and .', n: 1, l: ['b'] });
  });
});

describe('UploadGate', () => {
  it('limits concurrency and rejects waiters after the timeout', async () => {
    const gate = new UploadGate(1, 20, 5);
    const release = await gate.acquire();
    await expect(gate.acquire()).rejects.toMatchObject({ code: 'BUSY', status: 503 });
    release();
    release(); // idempotent
    expect(gate.inFlight).toBe(0);
    const again = await gate.acquire();
    again();
  });

  it('hands the slot to a waiter on release', async () => {
    const gate = new UploadGate(1, 1000, 5);
    const first = await gate.acquire();
    const second = gate.acquire();
    first();
    const release = await second;
    expect(gate.inFlight).toBe(1);
    release();
    expect(gate.inFlight).toBe(0);
  });

  it('rejects immediately when the queue is full', async () => {
    const gate = new UploadGate(1, 1000, 0);
    const release = await gate.acquire();
    await expect(gate.acquire()).rejects.toMatchObject({ code: 'BUSY' });
    release();
  });
});
