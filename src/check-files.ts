/**
 * Input checks for check_files, the tool that validates files sent as text. The hosted server cannot
 * read the user's disk, so the files arrive in the request. Everything stays in memory.
 */
export const FILE_LIMITS = {
  maxFiles: 300,
  maxFileBytes: 200_000,
  maxTotalBytes: 1_000_000,
  maxPathLength: 260,
} as const;

export type SanitizeResult =
  | { ok: true; files: Record<string, string> }
  | { ok: false; message: string };

/** A project-relative path: no absolute path, no drive letter, no `..`, no NUL or backslash. */
function checkPath(path: unknown): string | null {
  if (typeof path !== 'string' || path.trim() === '') return 'each file needs a non-empty path';
  if (path.length > FILE_LIMITS.maxPathLength) {
    return `path is longer than ${FILE_LIMITS.maxPathLength} characters: ${path.slice(0, 40)}...`;
  }
  if (path.includes('\0') || path.includes('\\')) return `path has a NUL or backslash: ${path}`;
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
    return `path must be relative to the project folder: ${path}`;
  }
  if (path.split('/').some((segment) => segment === '..')) return `path must not contain "..": ${path}`;
  return null;
}

export function sanitizeFiles(input: unknown): SanitizeResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, message: 'files must be a non-empty array of { path, content }' };
  }
  if (input.length > FILE_LIMITS.maxFiles) {
    return { ok: false, message: `at most ${FILE_LIMITS.maxFiles} files are accepted, got ${input.length}` };
  }

  const files: Record<string, string> = {};
  let total = 0;
  for (const entry of input) {
    const { path, content } = (entry ?? {}) as { path?: unknown; content?: unknown };
    const pathProblem = checkPath(path);
    if (pathProblem) return { ok: false, message: pathProblem };
    if (typeof content !== 'string') return { ok: false, message: `content of ${path} must be a string` };

    const normalised = (path as string).replace(/^(\.\/)+/, '');
    if (normalised in files) return { ok: false, message: `duplicate path: ${normalised}` };

    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > FILE_LIMITS.maxFileBytes) {
      return { ok: false, message: `${normalised} is larger than ${FILE_LIMITS.maxFileBytes} bytes` };
    }
    total += bytes;
    if (total > FILE_LIMITS.maxTotalBytes) {
      return { ok: false, message: `the files are larger than ${FILE_LIMITS.maxTotalBytes} bytes in total` };
    }
    files[normalised] = content;
  }
  return { ok: true, files };
}
