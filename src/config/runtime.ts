import fs from 'fs';
import path from 'path';

export interface RuntimeConfig {
  version: string;
  build: { commit: string | null; builtAt: string | null };
}

const PACKAGE_NAME = 'r-best-practices-mcp';

function versionFromPackageJson(file: string): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (pkg.name === PACKAGE_NAME && typeof pkg.version === 'string') return pkg.version;
  } catch {
    // not readable or not ours
  }
  return null;
}

/**
 * Version of this package: package.json in the working directory (server started from the repo or
 * the Docker WORKDIR), otherwise the nearest one above the entry script (MCP/CLI started elsewhere).
 * Only a package.json named `r-best-practices-mcp` counts, never an unrelated project's.
 */
function readPackageVersion(): string {
  const fromCwd = versionFromPackageJson(path.join(process.cwd(), 'package.json'));
  if (fromCwd) return fromCwd;
  try {
    if (process.argv[1]) {
      let dir = path.dirname(fs.realpathSync(process.argv[1]));
      for (let i = 0; i < 6; i++) {
        const found = versionFromPackageJson(path.join(dir, 'package.json'));
        if (found) return found;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
  } catch {
    // fall through
  }
  return process.env.npm_package_version || 'unknown';
}

/**
 * Build information, derived from the environment:
 * - GIT_SHA, BUILD_TIME: build information (set via build args, e.g. in Docker)
 */
export function getRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    version: readPackageVersion(),
    build: { commit: env.GIT_SHA?.trim() || null, builtAt: env.BUILD_TIME?.trim() || null },
  };
}
