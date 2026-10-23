import fs from 'fs';
import path from 'path';

/**
 * Read-only access to a project's files. The validator uses this instead of `fs` directly, so the
 * same rules can run on the server's disk (nodeProjectFs) or on files a browser already holds
 * (createMemoryProjectFs). Paths are strings in the implementation's own format.
 */
export interface ProjectEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface ProjectStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
}

export interface ProjectFs {
  /** Entries directly inside a directory. Rejects if it is not a readable directory. */
  readdir(dir: string): Promise<ProjectEntry[]>;
  /** Rejects if the path does not exist. */
  stat(p: string): Promise<ProjectStat>;
  /** UTF-8 text of a file. Rejects if it cannot be read. */
  readFile(p: string): Promise<string>;
  join(...parts: string[]): string;
  basename(p: string): string;
  dirname(p: string): string;
  relative(from: string, to: string): string;
  /** Absolute, normalised form of a path. */
  resolve(p: string): string;
}

/** The server's disk. */
export const nodeProjectFs: ProjectFs = {
  async readdir(dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() }));
  },
  async stat(p) {
    const s = await fs.promises.stat(p);
    return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size };
  },
  readFile: (p) => fs.promises.readFile(p, 'utf-8'),
  join: (...parts) => path.join(...parts),
  basename: (p) => path.basename(p),
  dirname: (p) => path.dirname(p),
  relative: (from, to) => path.relative(from, to),
  resolve: (p) => path.resolve(p),
};

/** POSIX-style path helpers for the in-memory file system (no Node 'path' module in the browser). */
function normalizePosix(p: string): string {
  const absolute = p.startsWith('/');
  const out: string[] = [];
  for (const segment of p.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else if (!absolute) out.push('..');
      continue;
    }
    out.push(segment);
  }
  const joined = out.join('/');
  return absolute ? `/${joined}` : joined || '.';
}

function joinPosix(...parts: string[]): string {
  return normalizePosix(parts.filter((part) => part !== '').join('/'));
}

function dirnamePosix(p: string): string {
  const normalized = normalizePosix(p);
  const index = normalized.lastIndexOf('/');
  if (index < 0) return '.';
  return index === 0 ? '/' : normalized.slice(0, index);
}

function basenamePosix(p: string): string {
  const normalized = normalizePosix(p);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function relativePosix(from: string, to: string): string {
  const a = normalizePosix(from).split('/').filter(Boolean);
  const b = normalizePosix(to).split('/').filter(Boolean);
  let common = 0;
  while (common < a.length && common < b.length && a[common] === b[common]) common++;
  return [...a.slice(common).map(() => '..'), ...b.slice(common)].join('/');
}

/**
 * A ProjectFs over an in-memory map of file paths to text, e.g. the files a browser selected.
 * Directories are implied by the file paths. Paths are normalised to absolute POSIX paths.
 */
export function createMemoryProjectFs(files: Record<string, string>): ProjectFs {
  const contents = new Map<string, string>();
  const directories = new Set<string>(['/']);
  for (const [rawPath, text] of Object.entries(files)) {
    const filePath = normalizePosix(`/${rawPath.replace(/^\/+/, '')}`);
    contents.set(filePath, text);
    let dir = dirnamePosix(filePath);
    while (!directories.has(dir)) {
      directories.add(dir);
      dir = dirnamePosix(dir);
    }
  }

  const encoder = new TextEncoder();
  const missing = (p: string): Error =>
    Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });

  return {
    async readdir(dir) {
      const target = normalizePosix(dir);
      if (!directories.has(target)) throw missing(target);
      const prefix = target === '/' ? '/' : `${target}/`;
      const seen = new Map<string, ProjectEntry>();
      for (const d of directories) {
        if (d !== target && d.startsWith(prefix) && !d.slice(prefix.length).includes('/')) {
          seen.set(d.slice(prefix.length), {
            name: d.slice(prefix.length),
            isDirectory: true,
            isFile: false,
          });
        }
      }
      for (const f of contents.keys()) {
        if (f.startsWith(prefix) && !f.slice(prefix.length).includes('/')) {
          const name = f.slice(prefix.length);
          seen.set(name, { name, isDirectory: false, isFile: true });
        }
      }
      return [...seen.values()];
    },
    async stat(p) {
      const target = normalizePosix(p);
      const text = contents.get(target);
      if (text !== undefined)
        return { isFile: true, isDirectory: false, size: encoder.encode(text).length };
      if (directories.has(target)) return { isFile: false, isDirectory: true, size: 0 };
      throw missing(target);
    },
    async readFile(p) {
      const text = contents.get(normalizePosix(p));
      if (text === undefined) throw missing(p);
      return text;
    },
    join: joinPosix,
    basename: basenamePosix,
    dirname: dirnamePosix,
    relative: relativePosix,
    resolve: (p) => normalizePosix(p.startsWith('/') ? p : `/${p}`),
  };
}
