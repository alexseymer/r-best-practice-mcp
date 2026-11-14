import { Finding } from '../../types/finding.js';
import type { ProjectFs } from '../project-fs.js';
import { listFilesAt, maskRSource, readText } from './helpers.js';

/**
 * Checks that look at one file's lines. They back the single-file validation (`validateFile`)
 * and the project rules that run the same check on every file of a kind.
 */

export function checkRFile(filePath: string, lines: string[]): Finding[] {
  const findings: Finding[] = [];

  // Check for functions
  const masked = maskRSource(lines.join('\n'), true);
  const hasFunctions =
    /(^|[\n;])[ \t]*[A-Za-z_.][\w.]*[ \t]*(<-|=)[ \t]*(function\b|\\[ \t]*\()/.test(masked);
  if (!hasFunctions && lines.length > 50) {
    findings.push({
      id: 'rscript-functions',
      severity: 'important',
      category: 'structure',
      file: filePath,
      message: 'Large scripts should contain functions for reusable logic',
      suggestions: ['Extract repeated logic into named functions'],
    });
  }

  return findings;
}

export function checkQmdFile(filePath: string, lines: string[]): Finding[] {
  const findings: Finding[] = [];

  // Check for YAML header
  if (!lines[0]?.startsWith('---')) {
    findings.push({
      id: 'quarto-yaml',
      severity: 'recommended',
      category: 'documentation',
      file: filePath,
      line: 1,
      message: 'Quarto document should have YAML frontmatter',
      suggestions: ['Start the document with a --- YAML block containing title and format'],
    });
  }

  // Check for labeled chunks
  const firstUnlabeled = findFirstUnlabeledRChunk(lines);
  if (firstUnlabeled !== undefined) {
    findings.push({
      id: 'quarto-labels',
      severity: 'recommended',
      category: 'structure',
      file: filePath,
      line: firstUnlabeled,
      message: 'Code chunks should have descriptive labels',
      suggestions: ['Add #| label: chunk-name as the first line inside each R code chunk'],
    });
  }

  return findings;
}

/** 1-based line of the first R chunk without a label, or undefined. */
function findFirstUnlabeledRChunk(rawLines: string[]): number | undefined {
  const lines = rawLines.map((l) => l.replace(/\r$/, ''));
  const fence = /^\s*`{3,}\s*\{\s*[rR](?=[\s,}])([^}]*)\}/;
  for (let i = 0; i < lines.length; i++) {
    const match = fence.exec(lines[i]);
    if (!match) continue;
    const header = match[1];
    const firstItem = header.split(',')[0].trim();
    const labelledInFence =
      /label\s*:/.test(header) || /(^|[\s,])label\s*=/.test(header) || /^[\w.-]+$/.test(firstItem);
    if (labelledInFence) continue;
    let labelledInOptions = false;
    for (let j = i + 1; j < lines.length && lines[j].trimStart().startsWith('#|'); j++) {
      if (/^\s*#\|\s*label\s*:/.test(lines[j])) {
        labelledInOptions = true;
        break;
      }
    }
    if (!labelledInOptions) return i + 1;
  }
  return undefined;
}

export function checkRmdFile(filePath: string, lines: string[]): Finding[] {
  const findings: Finding[] = [];

  // Check for YAML header
  if (!lines[0]?.startsWith('---')) {
    findings.push({
      id: 'rmd-yaml',
      severity: 'recommended',
      category: 'documentation',
      file: filePath,
      line: 1,
      message: 'R Markdown should have YAML header',
      suggestions: ['Start the document with a --- YAML block containing title and output'],
    });
  }

  return findings;
}

/** Line numbers (1-based) of column-0 assignments whose value is not a function. */
export function findTopLevelAssignments(lines: string[]): number[] {
  const result: number[] = [];
  const assignment = /^[A-Za-z_.][\w.]*\s*(<-|=)(?!=)\s*(.*)$/;
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('#')) return;
    const match = assignment.exec(line);
    if (match && !/^(function\b|\\\()/.test(match[2])) {
      result.push(idx + 1);
    }
  });
  return result;
}

/** Runs `check` on every file in the project root that matches `pattern`, keeping findings with `id`. */
export async function checkRootFiles(
  fsys: ProjectFs,
  dirPath: string,
  pattern: RegExp,
  check: (filePath: string, lines: string[]) => Finding[],
  id: string
): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const file of await listFilesAt(fsys, dirPath, pattern, false)) {
    const text = await readText(fsys, file);
    if (text === null) continue;
    out.push(...check(file, text.split('\n')).filter((f) => f.id === id));
  }
  return out;
}
