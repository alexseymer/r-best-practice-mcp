import fs from 'fs';
import path from 'path';

export const MAX_FILES = 200;
export const MAX_BYTES = 1_000_000;

const ALWAYS_SKIPPED = new Set([
  'node_modules',
  '.git',
  'renv',
  '_book',
  '_site',
  'public',
  'docs',
]);

export interface FindFilesOptions {
  recursive?: boolean;
  includeHidden?: boolean;
}

/** Sorted, capped file listing. `pattern` is matched against the file name. */
export async function findFiles(
  dirPath: string,
  pattern: RegExp,
  options: FindFilesOptions = {}
): Promise<string[]> {
  const { recursive = true, includeHidden = false } = options;
  const out: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (out.length >= MAX_FILES) return;
      if (ALWAYS_SKIPPED.has(entry.name)) continue;
      if (!includeHidden && entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) await walk(full);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        out.push(full);
      }
    }
  };

  await walk(dirPath);
  return out;
}

/** Reads a UTF-8 text file; returns null if it is missing, unreadable or larger than MAX_BYTES. */
export async function readText(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile() || stat.size > MAX_BYTES) return null;
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

/** True if any of the candidate names exists directly inside dirPath. */
export async function anyExists(dirPath: string, names: string[]): Promise<boolean> {
  const results = await Promise.all(names.map((n) => pathExists(path.join(dirPath, n))));
  return results.some(Boolean);
}
