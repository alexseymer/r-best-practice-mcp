/**
 * Upload validation that runs both on the server and in the browser: paths are normalised and
 * rejected on any traversal attempt, and sizes and counts are bounded. No Node imports.
 */
import { UPLOAD_LIMITS } from '../config/limits.js';

export type UploadErrorCode = 'INVALID_PARAMETER' | 'INVALID_WORKFLOW' | 'PAYLOAD_TOO_LARGE' | 'BUSY';

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
  // Same as path.posix.extname: no extension for names without a dot or starting with one
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
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
    const size = new TextEncoder().encode(content).length;
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
