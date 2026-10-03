import path from 'path';
import { RuleDef } from './types.js';
import fs from 'fs';
import {
  DEFAULT_SKIPPED_DIRS,
  MAX_FILES,
  compareNames,
  findFiles,
  maskRSource,
  readText,
} from './helpers.js';

const SNAKE_FILE = /^[a-z0-9]+(_[a-z0-9]+)*\.[Rr]$/;
const SECTION_START = /^#{4,}|^#\s*={4,}/;

/** `# Title ----`, `#### Title`, `# ====` ... Uses endsWith instead of `.*` regexes (quadratic). */
function isSectionMarker(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith('#')) return false;
  return SECTION_START.test(t) || t.endsWith('----') || t.endsWith('####') || t.endsWith('====');
}
const ERROR_HANDLING = /(?:^|[^\w.])(?:tryCatch|try|stopifnot|stop|withCallingHandlers)\(/;

const R_FILE = /\.[Rr]$/;

/**
 * `.R`/`.r` files in the project root, then in each first-level subdirectory (skipping hidden and
 * default-skipped directories), capped at MAX_FILES in total. Listing the levels explicitly keeps
 * the depth limit from being defeated by a file cap that deeper trees would use up.
 */
async function listScripts(dirPath: string): Promise<string[]> {
  const out = await findFiles(dirPath, R_FILE, { recursive: false });
  let entries: fs.Dirent[] = [];
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return out;
  }
  const dirs = entries
    .filter(
      (e) => e.isDirectory() && !e.name.startsWith('.') && !DEFAULT_SKIPPED_DIRS.includes(e.name)
    )
    .map((e) => e.name)
    .sort(compareNames);
  for (const name of dirs) {
    if (out.length >= MAX_FILES) break;
    out.push(...(await findFiles(path.join(dirPath, name), R_FILE, { recursive: false })));
  }
  return out.slice(0, MAX_FILES);
}

function toLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

const isComment = (line: string): boolean => line.trimStart().startsWith('#');

interface Opener {
  label: string;
  open: RegExp;
  /** Optional check on the original (unmasked) line text following the opener match. */
  reject?: RegExp;
  release: RegExp;
  releaseLabel: string;
}

const OPENERS: Opener[] = [
  {
    label: 'dbConnect()',
    open: /(?:^|[^\w])dbConnect\(/,
    release: /dbDisconnect\(/,
    releaseLabel: 'dbDisconnect()',
  },
  {
    label: 'file()',
    open: /(?:^|[^\w.])[A-Za-z._][\w.]*\s*(?:<-|=)\s*file\(\s*/,
    reject: /^["']stdin["']/,
    release: /(?:^|[^\w.])close\(/,
    releaseLabel: 'close()',
  },
  {
    label: 'url()',
    open: /(?:^|[^\w.])[A-Za-z._][\w.]*\s*(?:<-|=)\s*url\(/,
    release: /(?:^|[^\w.])close\(/,
    releaseLabel: 'close()',
  },
  {
    label: 'sink()',
    open: /(?:^|[^\w.])sink\(\s*(?!NULL\b)[^)\s]/,
    release: /(?:^|[^\w.])sink\(\s*(?:NULL\s*)?\)/,
    releaseLabel: 'sink()',
  },
  ...['pdf', 'png', 'jpeg', 'svg'].map((dev) => ({
    label: `${dev}()`,
    open: new RegExp(`(?:^|[^\\w.])${dev}\\(`),
    release: /(?:dev\.off|graphics\.off)\(/,
    releaseLabel: 'dev.off()',
  })),
];

interface Unmatched {
  label: string;
  line: number;
  release: string;
}

function findUnmatched(content: string): Unmatched | null {
  // Comments are removed and string contents blanked (same length), so openers and releases
  // inside strings or trailing comments are ignored; `original` keeps the real arguments.
  const original = toLines(content);
  const lines = toLines(maskRSource(content, true));
  const code = lines.join('\n');
  let first: Unmatched | null = null;
  for (const op of OPENERS) {
    if (op.release.test(code)) continue;
    const idx = lines.findIndex((l, i) => {
      const m = op.open.exec(l);
      if (!m) return false;
      return !op.reject || !op.reject.test(original[i].slice(m.index + m[0].length));
    });
    if (idx !== -1 && (first === null || idx + 1 < first.line)) {
      first = { label: op.label, line: idx + 1, release: op.releaseLabel };
    }
  }
  return first;
}

export const rscriptRules: RuleDef[] = [
  {
    id: 'rscript-naming',
    workflows: ['r-script'],
    async run({ dirPath }) {
      const files = await listScripts(dirPath);
      const bad = files.filter((f) => {
        const base = path.basename(f);
        return base !== '_targets.R' && !SNAKE_FILE.test(base);
      });
      if (bad.length === 0) return [];
      const names = bad.slice(0, 5).map((f) => path.relative(dirPath, f));
      return [
        {
          id: 'rscript-naming',
          severity: 'recommended',
          category: 'naming',
          message: `${bad.length} script filename(s) are not snake_case`,
          file: bad[0],
          details: `Non-snake_case scripts: ${names.join(', ')}${bad.length > 5 ? ', ...' : ''}`,
          suggestions: [
            `Rename ${path.basename(bad[0])} to a lowercase snake_case name such as data_cleaning.R`,
            'Use only lowercase letters, digits and underscores (no spaces or hyphens)',
          ],
        },
      ];
    },
  },
  {
    id: 'rscript-sections',
    workflows: ['r-script'],
    async run({ dirPath }) {
      for (const file of await listScripts(dirPath)) {
        const content = await readText(file);
        if (content === null) continue;
        const lines = toLines(content);
        if (lines.length <= 80) continue;
        const hasSection = lines.some(isSectionMarker);
        if (hasSection) continue;
        return [
          {
            id: 'rscript-sections',
            severity: 'recommended',
            category: 'structure',
            message: `Consider dividing ${path.basename(file)} (${lines.length} lines) into labelled sections`,
            file,
            suggestions: [
              'Add RStudio-style section headers such as "# Load data ----" and "# Clean data ----"',
              'Use Ctrl+Shift+R in RStudio to insert a section header and navigate via the outline',
            ],
          },
        ];
      }
      return [];
    },
  },
  {
    id: 'rscript-errors',
    workflows: ['r-script'],
    async run({ dirPath }) {
      for (const file of await listScripts(dirPath)) {
        const content = await readText(file);
        if (content === null) continue;
        const lines = toLines(content);
        if (lines.length <= 60) continue;
        if (lines.some((l) => !isComment(l) && ERROR_HANDLING.test(l))) continue;
        return [
          {
            id: 'rscript-errors',
            severity: 'recommended',
            category: 'structure',
            message: `Consider adding error handling to ${path.basename(file)} (${lines.length} lines, no tryCatch/stop/stopifnot)`,
            file,
            suggestions: [
              'Wrap risky steps (file reads, downloads, database calls) in tryCatch() with a clear error message',
              'Validate inputs early with stopifnot() or stop()',
            ],
          },
        ];
      }
      return [];
    },
  },
  {
    id: 'rscript-cleanup',
    workflows: ['r-script'],
    async run({ dirPath }) {
      const hits: (Unmatched & { file: string })[] = [];
      for (const file of await listScripts(dirPath)) {
        const content = await readText(file);
        if (content === null) continue;
        const m = findUnmatched(content);
        if (m) hits.push({ ...m, file });
      }
      if (hits.length === 0) return [];
      const first = hits[0];
      return [
        {
          id: 'rscript-cleanup',
          severity: 'recommended',
          category: 'structure',
          message: `Consider releasing resources: ${path.basename(first.file)} calls ${first.label} but never ${first.release}`,
          file: first.file,
          line: first.line,
          details: hits
            .slice(0, 5)
            .map((h) => `${path.relative(dirPath, h.file)}: ${h.label} without ${h.release}`)
            .join('; '),
          suggestions: [
            `Call ${first.release} when finished, ideally via on.exit() inside a function`,
            'Use withr::defer() or tryCatch(..., finally = ...) so cleanup also runs after errors',
          ],
        },
      ];
    },
  },
];
