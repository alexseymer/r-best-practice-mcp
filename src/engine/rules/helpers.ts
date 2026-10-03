import fs from 'fs';
import path from 'path';

export const MAX_FILES = 200;
export const MAX_BYTES = 1_000_000;

/** Directory names `findFiles` skips (at any depth) unless the caller passes `skipDirs`. */
export const DEFAULT_SKIPPED_DIRS: readonly string[] = [
  'node_modules',
  '.git',
  'renv',
  '_book',
  '_site',
  'public',
  'docs',
];

export interface FindFilesOptions {
  recursive?: boolean;
  includeHidden?: boolean;
  /** Directory names to skip at any depth. Replaces (does not extend) DEFAULT_SKIPPED_DIRS. */
  skipDirs?: readonly string[];
}

/** Locale-independent string comparison (UTF-16 code units). */
export function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Removes a leading UTF-8 byte order mark. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Blanks R comments (and optionally string contents) with spaces, keeping the text length and all
 * newlines so indices and line numbers stay valid. Quote-aware ("", '', ``, backslash escapes) and
 * linear. Strings may span lines. String delimiters are kept when `maskStrings` is true.
 */
export function maskRSource(text: string, maskStrings: boolean): string {
  const out: string[] = [];
  let quote = '';
  let inComment = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' || ch === '\r') {
      inComment = false;
      out.push(ch);
    } else if (inComment) {
      out.push(' ');
    } else if (quote !== '') {
      if (ch === '\\' && quote !== '`' && i + 1 < text.length && text[i + 1] !== '\n') {
        out.push(maskStrings ? '  ' : ch + text[i + 1]);
        i++;
      } else if (ch === quote) {
        quote = '';
        out.push(ch);
      } else {
        out.push(maskStrings ? ' ' : ch);
      }
    } else if (ch === '#') {
      inComment = true;
      out.push(' ');
    } else {
      if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      out.push(ch);
    }
  }
  return out.join('');
}

/** A single line without its trailing `# ...` comment (a `#` inside quotes is kept). Linear. */
export function stripLineComment(line: string): string {
  return maskRSource(line, false).trimEnd();
}

/** Sorted, capped file listing. `pattern` is matched against the file name. */
export async function findFiles(
  dirPath: string,
  pattern: RegExp,
  options: FindFilesOptions = {}
): Promise<string[]> {
  const { recursive = true, includeHidden = false } = options;
  const skipped = new Set(options.skipDirs ?? DEFAULT_SKIPPED_DIRS);
  const out: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => compareNames(a.name, b.name));
    for (const entry of entries) {
      if (out.length >= MAX_FILES) return;
      if (skipped.has(entry.name)) continue;
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
