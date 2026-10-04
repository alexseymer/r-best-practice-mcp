/**
 * Browser uploads: validation of the posted file list and a sandboxed temp directory to run the
 * regular (path based) detector and validator against. Everything in here treats the upload as
 * hostile: paths are normalised and rejected on any traversal attempt, sizes are bounded, files
 * are written exclusively (never overwritten, never symlinks) and the directory is always removed.
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { UPLOAD_LIMITS } from '../config/runtime.js';
import { logger } from '../utils/logger.js';

export type UploadErrorCode = 'INVALID_PARAMETER' | 'PAYLOAD_TOO_LARGE' | 'BUSY';

/** An upload problem that maps to an HTTP status; the message never contains raw input. */
export class UploadError extends Error {
  readonly status: number;
  readonly code: UploadErrorCode;

  constructor(code: UploadErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.status = status ?? (code === 'PAYLOAD_TOO_LARGE' ? 413 : code === 'BUSY' ? 503 : 400);
  }
}

export interface UploadLimits {
  readonly maxFiles: number;
  readonly maxFileBytes: number;
  readonly maxTotalBytes: number;
  readonly maxPathLength: number;
  readonly allowedExtensions: readonly string[];
  readonly allowedFileNames: readonly string[];
}

export interface UploadFile {
  path: string;
  content: string;
}

export interface SanitizedUpload {
  /** Accepted files with normalised relative paths. */
  files: UploadFile[];
  /** UTF-8 bytes of the accepted files. */
  bytes: number;
  /** Entries ignored because their name/extension is not allowed. */
  skipped: number;
}

/** Maximum number of path segments (directory depth + file name). */
export const MAX_UPLOAD_DEPTH = 20;
/** Neutral label used instead of the temp directory in results. */
export const UPLOAD_LABEL = 'uploaded project';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function invalid(message: string): never {
  throw new UploadError('INVALID_PARAMETER', message);
}

function tooLarge(message: string): never {
  throw new UploadError('PAYLOAD_TOO_LARGE', message);
}

function isAllowedName(
  segments: readonly string[],
  limits: Pick<UploadLimits, 'allowedExtensions' | 'allowedFileNames'>
): boolean {
  const name = segments[segments.length - 1];
  if (limits.allowedFileNames.includes(name)) return true;
  const ext = path.posix.extname(name).toLowerCase();
  return ext !== '' && limits.allowedExtensions.includes(ext);
}

/** Normalises one path (backslashes to `/`) or throws; returns its segments. */
function normaliseSegments(raw: string, index: number, limits: UploadLimits): string[] {
  const label = `files[${index}].path`;
  if (raw.length === 0) invalid(`${label} must not be empty`);
  if (raw.length > limits.maxPathLength) {
    invalid(`${label} is longer than ${limits.maxPathLength} characters`);
  }
  if (CONTROL_CHARS.test(raw)) invalid(`${label} contains control characters`);
  const normalised = raw.replace(/\\/g, '/');
  if (normalised.startsWith('/') || /^[A-Za-z]:/.test(normalised)) {
    invalid(`${label} must be relative to the project root`);
  }
  const segments = normalised.split('/');
  for (const segment of segments) {
    if (segment === '') invalid(`${label} contains an empty path segment`);
    if (segment === '.' || segment === '..') {
      invalid(`${label} must not contain "." or ".." segments`);
    }
  }
  if (segments.length > MAX_UPLOAD_DEPTH) {
    invalid(`${label} is nested deeper than ${MAX_UPLOAD_DEPTH} levels`);
  }
  return segments;
}

/**
 * Validates the `files` array of an upload request. Returns the accepted files (disallowed
 * names are skipped and counted) or throws an UploadError.
 */
export function sanitizeUpload(
  body: unknown,
  limits: UploadLimits = UPLOAD_LIMITS
): SanitizedUpload {
  const files = body && typeof body === 'object' ? (body as { files?: unknown }).files : undefined;
  if (!Array.isArray(files)) invalid('files must be an array of { path, content } objects');
  if (files.length === 0) invalid('files must contain at least one file');
  if (files.length > limits.maxFiles) {
    tooLarge(`Too many files: ${files.length} (maximum ${limits.maxFiles})`);
  }

  const seen = new Set<string>();
  const accepted: UploadFile[] = [];
  const acceptedPaths = new Set<string>();
  let skipped = 0;
  let bytes = 0;

  files.forEach((entry: unknown, index: number) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      invalid(`files[${index}] must be an object with path and content`);
    }
    const { path: rawPath, content } = entry as { path?: unknown; content?: unknown };
    if (typeof rawPath !== 'string') invalid(`files[${index}].path must be a string`);
    const segments = normaliseSegments(rawPath, index, limits);
    const normalised = segments.join('/');
    if (seen.has(normalised)) invalid(`files[${index}].path duplicates an earlier path`);
    seen.add(normalised);
    if (typeof content !== 'string') invalid(`files[${index}].content must be a string`);

    if (!isAllowedName(segments, limits)) {
      skipped++;
      return;
    }
    const size = Buffer.byteLength(content, 'utf8');
    if (size > limits.maxFileBytes) {
      tooLarge(`files[${index}] is larger than ${limits.maxFileBytes} bytes`);
    }
    bytes += size;
    if (bytes > limits.maxTotalBytes) {
      tooLarge(`Upload is larger than ${limits.maxTotalBytes} bytes in total`);
    }
    accepted.push({ path: normalised, content });
    acceptedPaths.add(normalised);
  });

  if (accepted.length === 0) {
    invalid('The upload contains no supported files (R, Quarto, YAML, DESCRIPTION, ... files)');
  }

  // A file may not also be a directory ("a" and "a/b").
  for (const p of acceptedPaths) {
    const segments = p.split('/');
    for (let i = 1; i < segments.length; i++) {
      if (acceptedPaths.has(segments.slice(0, i).join('/'))) {
        invalid('The upload uses the same path as both a file and a directory');
      }
    }
  }

  return { files: accepted, bytes, skipped };
}

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
 * Replaces the absolute temp directory in every string of `value` (deeply): `<dir>/x` becomes
 * `x`, a bare `<dir>` becomes `.`. Used so results never reveal server paths.
 */
export function stripDirPrefix<T>(value: T, dirs: readonly string[]): T {
  const roots = [...new Set(dirs.filter(Boolean))].sort((a, b) => b.length - a.length);
  const scrub = (s: string): string => {
    let out = s;
    for (const root of roots) {
      out = out
        .split(root + '/')
        .join('')
        .split(root + '\\')
        .join('')
        .split(root)
        .join('.');
    }
    return out;
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return scrub(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, walk(val)]));
    }
    return v;
  };
  return walk(value) as T;
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
