import type { ProjectFs } from '../project-fs.js';
import { RuleDef } from './types.js';
import {
  DEFAULT_SKIPPED_DIRS,
  MAX_FILES,
  compareNames,
  findFiles,
  listFilesAt,
  maskRSource,
  readText,
  stripBom,
} from './helpers.js';
import { checkRFile, findTopLevelAssignments } from './file-checks.js';

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
async function listScripts(fsys: ProjectFs, dirPath: string): Promise<string[]> {
  const out = await findFiles(fsys, dirPath, R_FILE, { recursive: false });
  let entries: Awaited<ReturnType<typeof fsys.readdir>> = [];
  try {
    entries = await fsys.readdir(dirPath);
  } catch {
    return out;
  }
  const dirs = entries
    .filter(
      (e) => e.isDirectory && !e.name.startsWith('.') && !DEFAULT_SKIPPED_DIRS.includes(e.name)
    )
    .map((e) => e.name)
    .sort(compareNames);
  for (const name of dirs) {
    if (out.length >= MAX_FILES) break;
    out.push(...(await findFiles(fsys, fsys.join(dirPath, name), R_FILE, { recursive: false })));
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

const RSCRIPT_GLOBALS_THRESHOLD = 15;

/** Root `.R`/`.r` files, sorted by name. */
async function rootScripts(fsys: ProjectFs, dirPath: string): Promise<string[]> {
  return (await findFiles(fsys, dirPath, /\.[Rr]$/, { recursive: false })).sort((x, y) =>
    compareNames(fsys.basename(x), fsys.basename(y))
  );
}

export const rscriptRules: RuleDef[] = [
  {
    id: 'rscript-header',
    workflows: ['r-script'],
    async run({ dirPath, fsys }) {
      for (const file of await rootScripts(fsys, dirPath)) {
        const text = await readText(fsys, file);
        if (text === null) continue;
        if (!stripBom(text).startsWith('#')) {
          return [
            {
              id: 'rscript-header',
              severity: 'recommended',
              category: 'documentation',
              file,
              line: 1,
              message: 'Script should start with header comment',
              suggestions: ['# Purpose: [description]', '# Author: [name]', '# Date: [date]'],
            },
          ];
        }
      }
      return [];
    },
  },
  {
    id: 'rscript-functions',
    workflows: ['r-script'],
    async run({ dirPath, fsys }) {
      for (const file of await rootScripts(fsys, dirPath)) {
        const text = await readText(fsys, file);
        if (text === null) continue;
        const found = checkRFile(file, stripBom(text).split('\n'));
        if (found.length > 0) return found;
      }
      return [];
    },
  },
  {
    id: 'rscript-globals',
    workflows: ['r-script'],
    async run({ dirPath, fsys }) {
      for (const file of await listFilesAt(fsys, dirPath, /\.R$/, false)) {
        const globals = findTopLevelAssignments((await fsys.readFile(file)).split(/\r?\n/));
        if (globals.length > RSCRIPT_GLOBALS_THRESHOLD) {
          return [
            {
              id: 'rscript-globals',
              severity: 'important',
              category: 'structure',
              file,
              line: globals[0],
              message: `Consider wrapping logic in functions: ${globals.length} top-level assignments create many global variables`,
              suggestions: [
                'Wrap logic in functions with parameters',
                'Add a main() entry point and call it at the end of the script',
                'Use local scope for intermediate variables',
              ],
            },
          ];
        }
      }
      return [];
    },
  },
  {
    id: 'rscript-naming',
    workflows: ['r-script'],
    async run({ dirPath, fsys }) {
      const files = await listScripts(fsys, dirPath);
      const bad = files.filter((f) => {
        const base = fsys.basename(f);
        return base !== '_targets.R' && !SNAKE_FILE.test(base);
      });
      if (bad.length === 0) return [];
      const names = bad.slice(0, 5).map((f) => fsys.relative(dirPath, f));
      return [
        {
          id: 'rscript-naming',
          severity: 'recommended',
          category: 'naming',
          message: `${bad.length} script filename(s) are not snake_case`,
          file: bad[0],
          details: `Non-snake_case scripts: ${names.join(', ')}${bad.length > 5 ? ', ...' : ''}`,
          suggestions: [
            `Rename ${fsys.basename(bad[0])} to a lowercase snake_case name such as data_cleaning.R`,
            'Use only lowercase letters, digits and underscores (no spaces or hyphens)',
          ],
        },
      ];
    },
  },
  {
    id: 'rscript-sections',
    workflows: ['r-script'],
    async run({ dirPath, fsys }) {
      for (const file of await listScripts(fsys, dirPath)) {
        const content = await readText(fsys, file);
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
            message: `Consider dividing ${fsys.basename(file)} (${lines.length} lines) into labelled sections`,
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
    async run({ dirPath, fsys }) {
      for (const file of await listScripts(fsys, dirPath)) {
        const content = await readText(fsys, file);
        if (content === null) continue;
        const lines = toLines(content);
        if (lines.length <= 60) continue;
        if (lines.some((l) => !isComment(l) && ERROR_HANDLING.test(l))) continue;
        return [
          {
            id: 'rscript-errors',
            severity: 'recommended',
            category: 'structure',
            message: `Consider adding error handling to ${fsys.basename(file)} (${lines.length} lines, no tryCatch/stop/stopifnot)`,
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
    async run({ dirPath, fsys }) {
      const hits: (Unmatched & { file: string })[] = [];
      for (const file of await listScripts(fsys, dirPath)) {
        const content = await readText(fsys, file);
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
          message: `Consider releasing resources: ${fsys.basename(first.file)} calls ${first.label} but never ${first.release}`,
          file: first.file,
          line: first.line,
          details: hits
            .slice(0, 5)
            .map((h) => `${fsys.relative(dirPath, h.file)}: ${h.label} without ${h.release}`)
            .join('; '),
          suggestions: [
            `Call ${first.release} when finished, ideally via on.exit() inside a function`,
            'Use withr::defer() or tryCatch(..., finally = ...) so cleanup also runs after errors',
          ],
        },
      ];
    },
  },
  {
    id: 'rscript-paths',
    workflows: ['r-script'],
    async run({ dirPath, fsys }) {
      const hits: { file: string; line: number; what: string }[] = [];
      for (const file of await listScripts(fsys, dirPath)) {
        const content = await readText(fsys, file);
        if (content === null) continue;
        const masked = toLines(maskRSource(content, true));
        const original = toLines(content);
        for (let i = 0; i < masked.length; i++) {
          if (/(?:^|[^\w.])setwd\(/.test(masked[i])) {
            hits.push({ file, line: i + 1, what: 'setwd()' });
            break;
          }
          const abs = /["'](?:\/Users\/|\/home\/|[A-Za-z]:[\\/])/.exec(original[i] ?? '');
          if (abs && masked[i].includes(abs[0][0]) && !isComment(original[i].slice(0, abs.index))) {
            hits.push({ file, line: i + 1, what: 'an absolute path' });
            break;
          }
        }
      }
      if (hits.length === 0) return [];
      const first = hits[0];
      return [
        {
          id: 'rscript-paths',
          severity: 'recommended',
          category: 'structure',
          message: `Consider project-relative paths: ${fsys.basename(first.file)} uses ${first.what}`,
          file: first.file,
          line: first.line,
          details: hits
            .slice(0, 5)
            .map((h) => `${fsys.relative(dirPath, h.file)}:${h.line} ${h.what}`)
            .join('; '),
          suggestions: [
            'Open the project as an RStudio/Positron project and use here::here("data", "file.csv")',
            'Remove setwd(); it changes global state and breaks on other machines',
          ],
        },
      ];
    },
  },
];
