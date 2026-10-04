import fs from 'fs';
import path from 'path';

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

export interface RuntimeConfig {
  version: string;
  build: { commit: string | null; builtAt: string | null };
  serverPaths: {
    /** true: any absolute path on the host may be analysed (local use). false: only inside `roots`. */
    unrestricted: boolean;
    roots: string[];
  };
  upload: { enabled: true } & typeof UPLOAD_LIMITS;
  metrics: {
    /** true: /metrics* are served without credentials. */
    public: boolean;
    /** true: /metrics* require `Authorization: Bearer <METRICS_TOKEN>`. When neither public nor tokenRequired they are disabled. */
    tokenRequired: boolean;
  };
}

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
    if (typeof pkg.version === 'string') return pkg.version;
  } catch {
    // fall through
  }
  return process.env.npm_package_version || 'unknown';
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Deployment-dependent settings, derived from the environment:
 * - ALLOW_ANY_PATH=true | ALLOWED_PROJECT_ROOTS=/a,/b: server-path mode (default: unrestricted unless
 *   NODE_ENV=production, then only /projects)
 * - METRICS_TOKEN / METRICS_PUBLIC=true: access to /metrics* (default: public unless NODE_ENV=production)
 * - GIT_SHA, BUILD_TIME: build information (set via Docker build args)
 */
export function getRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const production = env.NODE_ENV === 'production';

  const configuredRoots = splitList(env.ALLOWED_PROJECT_ROOTS).map((r) => path.resolve(r));
  let serverPaths: RuntimeConfig['serverPaths'];
  if (env.ALLOW_ANY_PATH === 'true') {
    serverPaths = { unrestricted: true, roots: [] };
  } else if (configuredRoots.length > 0) {
    serverPaths = { unrestricted: false, roots: configuredRoots };
  } else if (production) {
    serverPaths = { unrestricted: false, roots: [path.resolve('/projects')] };
  } else {
    serverPaths = { unrestricted: true, roots: [] };
  }

  const token = (env.METRICS_TOKEN ?? '').trim();
  let metrics: RuntimeConfig['metrics'];
  if (env.METRICS_PUBLIC === 'true') metrics = { public: true, tokenRequired: false };
  else if (token) metrics = { public: false, tokenRequired: true };
  else metrics = { public: !production, tokenRequired: false };

  return {
    version: readPackageVersion(),
    build: { commit: env.GIT_SHA?.trim() || null, builtAt: env.BUILD_TIME?.trim() || null },
    serverPaths,
    upload: { enabled: true, ...UPLOAD_LIMITS },
    metrics,
  };
}
