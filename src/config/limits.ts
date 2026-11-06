/**
 * Pure limits shared by the server and the browser engine. No Node imports: the browser loads this file.
 */
/** Limits for browser uploads (`POST /api/validate-upload`); also exposed to the dashboard via `/api/config`. */
export const UPLOAD_LIMITS = {
  maxFiles: 500,
  maxFileBytes: 1_000_000,
  maxTotalBytes: 5_000_000,
  maxPathLength: 260,
  /** Lower-case extensions (with dot) that may be uploaded. */
  allowedExtensions: [
    '.r',
    '.rmd',
    '.qmd',
    '.md',
    '.yml',
    '.yaml',
    '.toml',
    '.json',
    '.lock',
    '.txt',
    '.dcf',
    '.bib',
    '.css',
    '.html',
    '.rproj',
  ],
  /** Extension-less (or dot-prefixed) file names that may be uploaded, compared case-sensitively. */
  allowedFileNames: [
    'DESCRIPTION',
    'NAMESPACE',
    'LICENSE',
    'LICENCE',
    'NEWS',
    'README',
    'Makefile',
    'Dockerfile',
    '.Rprofile',
    '.Rbuildignore',
    '.gitignore',
    '.dockerignore',
  ],
} as const;

/**
 * Routes that accept a larger JSON body than the global default (bytes). The global body parser must skip
 * these paths; each route mounts its own parser with this limit.
 */
export const LARGE_BODY_ROUTES: Readonly<Record<string, number>> = {
  '/api/validate-upload': 8 * 1024 * 1024,
};
