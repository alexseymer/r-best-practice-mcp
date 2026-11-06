/**
 * Browser uploads on the server: the sanitising rules (upload-sanitize.ts) plus a sandboxed temp
 * directory to run the path-based validator against. The directory is always removed.
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger.js';
import { UploadError, UploadFile } from './upload-sanitize.js';

export * from './upload-sanitize.js';

function isInside(root: string, target: string): boolean {
  return target === root || target.startsWith(root + path.sep);
}

/**
 * Writes `files` (already sanitised) into a fresh private temp directory, runs `fn` with the
 * directory (real path, plus the pre-realpath spelling) and always deletes the directory afterwards, also when `fn` or the write throws.
 */
export async function withUploadedProject<T>(
  files: readonly UploadFile[],
  fn: (dir: string, createdDir: string) => Promise<T>
): Promise<T> {
  const base = process.env.UPLOAD_TMP_DIR?.trim() || os.tmpdir();
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const created = await fs.mkdtemp(path.join(base, 'rbp-upload-'));
  try {
    const root = await fs.realpath(created);
    await fs.chmod(root, 0o700);
    for (const file of files) {
      const segments = file.path.split('/');
      // Defence in depth: the paths were sanitised, but this function is also exported.
      if (segments.some((s) => s === '' || s === '.' || s === '..') || path.isAbsolute(file.path)) {
        throw new UploadError('INVALID_PARAMETER', 'Invalid file path in upload');
      }
      const target = path.join(root, ...segments);
      if (!isInside(root, target)) {
        throw new UploadError('INVALID_PARAMETER', 'Invalid file path in upload');
      }
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      try {
        await fs.writeFile(target, file.content, { flag: 'wx', mode: 0o600 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new UploadError('INVALID_PARAMETER', 'The upload contains conflicting paths');
        }
        throw error;
      }
      const real = await fs.realpath(target);
      if (!isInside(root, real)) {
        throw new UploadError('INVALID_PARAMETER', 'Invalid file path in upload');
      }
    }
    return await fn(root, created);
  } finally {
    try {
      await fs.rm(created, { recursive: true, force: true });
    } catch (error) {
      logger.error('Failed to remove upload directory', error);
    }
  }
}

/**
 * Limits how many uploads are analysed at once. Excess callers wait up to `waitMs` (and at most
 * `maxQueue` may wait) before being turned away with a BUSY error.
 */
export class UploadGate {
  private active = 0;
  private waiters: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent = 2,
    private readonly waitMs = 3000,
    private readonly maxQueue = 8
  ) {}

  /** Resolves with a release function (call exactly once) or rejects with a BUSY UploadError. */
  acquire(): Promise<() => void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve(this.makeRelease());
    }
    if (this.waiters.length >= this.maxQueue) return Promise.reject(this.busy());
    return new Promise((resolve, reject) => {
      const grant = (): void => {
        clearTimeout(timer);
        this.active++;
        resolve(this.makeRelease());
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== grant);
        reject(this.busy());
      }, this.waitMs);
      this.waiters.push(grant);
    });
  }

  get inFlight(): number {
    return this.active;
  }

  private busy(): UploadError {
    return new UploadError(
      'BUSY',
      'The server is busy analysing other uploads. Try again shortly.'
    );
  }

  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      const next = this.waiters.shift();
      if (next) next();
    };
  }
}
