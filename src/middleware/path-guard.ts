import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import type { RuntimeConfig } from '../config/runtime.js';
import { SecurityUtils } from '../utils/security.js';

export const PATH_NOT_ALLOWED_MESSAGE = 'Path is not available on this server';

/** `res.locals` key under which the guard stores the confined real path. */
export const RESOLVED_PATH_KEY = 'resolvedPath';

async function realpathOrNull(p: string): Promise<string | null> {
  try {
    return await fs.promises.realpath(p);
  } catch {
    return null;
  }
}

function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
}

/**
 * Resolve a client-supplied path and confine it to `roots`.
 *
 * Returns the real path (symlinks resolved) when it exists and lies inside, or equals, one of the
 * roots (which are resolved too); otherwise null. Relative paths, non-strings, NUL bytes, traversal,
 * symlink escapes, missing paths and missing roots all give null, so callers cannot tell them apart.
 */
export async function resolveAllowedPath(
  input: unknown,
  roots: readonly string[]
): Promise<string | null> {
  if (!SecurityUtils.isValidFilePath(input as string)) return null;
  const raw = input as string;
  if (!path.isAbsolute(raw)) return null;

  // Always resolve the input and every root, without branching on what exists
  const [real, realRoots] = await Promise.all([
    realpathOrNull(path.resolve(raw)),
    Promise.all(roots.map((r) => realpathOrNull(path.resolve(r)))),
  ]);

  let allowed = false;
  for (const root of realRoots) {
    if (real !== null && root !== null && isInside(root, real)) allowed = true;
  }
  return allowed ? real : null;
}

/** Fixed rejection used for every kind of disallowed path. */
export function sendPathNotAllowed(res: Response): void {
  res
    .status(400)
    .json({ error: true, code: 'PATH_NOT_ALLOWED', message: PATH_NOT_ALLOWED_MESSAGE });
}

/**
 * Express middleware for routes taking `body.path`. In unrestricted mode it does nothing. Otherwise
 * a malformed or missing `path` is left to the route's own validation (no filesystem access), and any
 * other value must resolve inside the allowed roots; the confined real path is exposed through
 * `getConfinedPath(res)` and must be used instead of the raw input.
 */
export function pathGuard(serverPaths: RuntimeConfig['serverPaths']) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (serverPaths.unrestricted) {
      next();
      return;
    }
    try {
      const input = (req.body as { path?: unknown } | undefined)?.path;
      if (!input || !SecurityUtils.isValidFilePath(input as string)) {
        next();
        return;
      }
      const real = await resolveAllowedPath(input, serverPaths.roots);
      if (real === null) {
        sendPathNotAllowed(res);
        return;
      }
      res.locals[RESOLVED_PATH_KEY] = real;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** The confined real path set by `pathGuard`, or `fallback` (the raw input) in unrestricted mode. */
export function getConfinedPath(res: Response, fallback: string): string {
  const value = res.locals[RESOLVED_PATH_KEY];
  return typeof value === 'string' ? value : fallback;
}
