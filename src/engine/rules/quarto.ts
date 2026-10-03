import path from 'path';
import { RuleDef } from './types.js';
import { findFiles, readText } from './helpers.js';

export interface Chunk {
  /** 1-based line of the opening fence. */
  line: number;
  /** Text after the opening fence, e.g. `{r setup, include=FALSE}`. */
  header: string;
  /** Raw leading `#|` option lines. */
  optionLines: string[];
  /** Option keys found in the leading `#|` lines (e.g. `fig-cap`). */
  optionKeys: string[];
  /** Code without option lines, with string literals and comments blanked out. */
  code: string;
}

export interface ParsedDoc {
  frontMatter: string;
  chunks: Chunk[];
  /** Non-empty, non-heading lines outside the front matter and outside fenced blocks. */
  narrative: string[];
}

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const R_HEADER = /^\{r(?=[\s,}])/;

function blankStringsAndComments(line: string): string {
  return line.replace(/"[^"\n]*"|'[^'\n]*'/g, '""').replace(/#.*$/, '');
}

/** Splits a .qmd / .Rmd text into front matter, R chunks and narrative lines. Never throws. */
export function parseDoc(text: string): ParsedDoc {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.split(/\r?\n/);
  let i = 0;
  let frontMatter = '';
  if (lines[0]?.trim() === '---') {
    for (let j = 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t === '---' || t === '...') {
        frontMatter = lines.slice(1, j).join('\n');
        i = j + 1;
        break;
      }
    }
  }

  const chunks: Chunk[] = [];
  const narrative: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    const m = FENCE_OPEN.exec(line);
    const fenceChar = m?.[1][0];
    if (m && !(fenceChar === '`' && m[2].includes('`'))) {
      const fence = m[1];
      const header = m[2].trim();
      const closeRe = new RegExp(`^ {0,3}\\${fenceChar}{${fence.length},}\\s*$`);
      const start = i;
      i++;
      const body: string[] = [];
      while (i < lines.length && !closeRe.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // skip closing fence (or end of file)
      if (R_HEADER.test(header)) {
        let k = 0;
        const optionLines: string[] = [];
        while (k < body.length && body[k].trim().startsWith('#|')) {
          optionLines.push(body[k].trim());
          k++;
        }
        const optionKeys: string[] = [];
        for (const o of optionLines) {
          const km = /^#\|\s*([A-Za-z0-9_.-]+)\s*:/.exec(o);
          if (km) optionKeys.push(km[1]);
        }
        chunks.push({
          line: start + 1,
          header,
          optionLines,
          optionKeys,
          code: body.slice(k).map(blankStringsAndComments).join('\n'),
        });
      }
      continue;
    }
    const t = line.trim();
    if (t !== '' && !t.startsWith('#') && !/^:{3,}/.test(t)) narrative.push(t);
    i++;
  }
  return { frontMatter, chunks, narrative };
}

export interface LoadedDoc extends ParsedDoc {
  file: string;
  name: string;
}

export async function loadDocs(
  dirPath: string,
  pattern: RegExp,
  recursive = true
): Promise<LoadedDoc[]> {
  const files = await findFiles(dirPath, pattern, { recursive });
  const docs: LoadedDoc[] = [];
  for (const file of files) {
    const text = await readText(file);
    if (text === null) continue;
    docs.push({ ...parseDoc(text), file, name: path.relative(dirPath, file) || file });
  }
  return docs;
}

/** Joins up to 5 items for a finding's `details`. */
export function summarize(items: string[]): string {
  const shown = items.slice(0, 5).join(', ');
  return items.length > 5 ? `${shown} (and ${items.length - 5} more)` : shown;
}

async function readProjectConfig(dirPath: string): Promise<string> {
  const parts: string[] = [];
  for (const name of ['_quarto.yml', '_quarto.yaml']) {
    const t = await readText(path.join(dirPath, name));
    if (t !== null) parts.push(t);
  }
  return parts.join('\n');
}

const PLOT_CALL = /(^|[^A-Za-z0-9_.])(ggplot|plot|hist|barplot|boxplot)\s*\(/;
const PLOT_LABEL_CALL = /(^|[^A-Za-z0-9_.])(labs|ggtitle|xlab|ylab)\s*\(/g;

/** Removes every call matching `opening` (up to its balanced closing paren). Linear scan. */
function removeCalls(code: string, opening: RegExp): string {
  let out = '';
  let pos = 0;
  opening.lastIndex = 0;
  for (let m = opening.exec(code); m !== null; m = opening.exec(code)) {
    const start = m.index + m[1].length;
    if (start < pos) continue;
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < code.length && depth > 0) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') depth--;
      i++;
    }
    out += code.slice(pos, start);
    pos = i;
    opening.lastIndex = i;
  }
  return out + code.slice(pos);
}

const TABLE_CALL =
  /(^|[^A-Za-z0-9_.])(kable|kbl|gt|kable_styling|kable_classic|kable_paper|kable_minimal|add_header_above)\s*\(|kableExtra::/;

/** Text between `{r` and the closing brace of a chunk header, e.g. ` setup, include=FALSE`. */
export function headerBody(header: string): string {
  const end = header.lastIndexOf('}');
  return header.slice(2, end === -1 ? undefined : end);
}

const OPTION_NAME = '(echo|eval|include|warning|message|fig[.-][A-Za-z]+)';
const HEADER_OPTION = new RegExp(`(^|[\\s,])${OPTION_NAME}\\s*=`);
const CHUNK_OPTION_LINE = new RegExp(`^#\\|\\s*${OPTION_NAME}\\s*:`);
const HIDDEN_HEADER_OPTION = /(^|[\s,])(eval|include)\s*=\s*(FALSE|F)(?![\w.])/;

/** True if a knitr-style header option (`{r, echo=FALSE}`) is set explicitly. */
export function hasHeaderOption(chunk: Chunk): boolean {
  return HEADER_OPTION.test(headerBody(chunk.header));
}

/** True if the chunk has a `#| echo|eval|include|warning|message|fig-*:` option line. */
export function hasOptionLine(chunk: Chunk): boolean {
  return chunk.optionLines.some((o) => CHUNK_OPTION_LINE.test(o));
}

/** True if the chunk sets options through knitr::opts_chunk$set() (code is comment-stripped). */
export function callsOptsChunkSet(text: string): boolean {
  return /opts_chunk\$set\s*\(/.test(text);
}

function hasOption(chunk: Chunk, ...keys: string[]): boolean {
  return chunk.optionKeys.some((k) => keys.includes(k));
}

/** Chunks that are not evaluated or not shown produce no figure/table in the output. */
function isHidden(chunk: Chunk): boolean {
  if (chunk.optionLines.some((o) => /^#\|\s*(eval|include)\s*:\s*(false|no)\b/i.test(o))) {
    return true;
  }
  return HIDDEN_HEADER_OPTION.test(headerBody(chunk.header));
}

export const quartoRules: RuleDef[] = [
  {
    id: 'quarto-options',
    workflows: ['quarto'],
    async run({ dirPath }) {
      const docs = await loadDocs(dirPath, /\.qmd$/);
      const chunks = docs.flatMap((d) => d.chunks);
      if (chunks.length === 0) return [];
      if (chunks.some((c) => c.optionLines.length > 0)) return [];
      // knitr-style explicit options: {r, echo=FALSE} and knitr::opts_chunk$set()
      if (chunks.some((c) => hasHeaderOption(c) || callsOptsChunkSet(c.code))) return [];
      const execRe = /^execute\s*:/m;
      if (docs.some((d) => execRe.test(d.frontMatter))) return [];
      if (execRe.test(await readProjectConfig(dirPath))) return [];
      const first = docs.find((d) => d.chunks.length > 0)!;
      return [
        {
          id: 'quarto-options',
          severity: 'recommended',
          category: 'structure',
          file: first.file,
          line: first.chunks[0].line,
          message:
            'Consider setting chunk options explicitly: no code chunk has a #| or header option, no opts_chunk$set() call and no execute: block was found',
          suggestions: [
            'Add options such as #| echo: false or #| warning: false at the top of chunks',
            'Or set project-wide defaults with an execute: block in _quarto.yml or the document YAML',
          ],
          details: `${chunks.length} R chunk(s) in ${docs.length} .qmd file(s) without any #| option or execute: block`,
        },
      ];
    },
  },
  {
    id: 'quarto-caching',
    workflows: ['quarto'],
    async run({ dirPath }) {
      const docs = await loadDocs(dirPath, /\.qmd$/);
      const total = docs.reduce((n, d) => n + d.chunks.length, 0);
      if (total < 3) return [];
      const setting = /(^|[^A-Za-z0-9_])(cache|freeze)\s*[:=]/m;
      if (setting.test(await readProjectConfig(dirPath))) return [];
      for (const d of docs) {
        if (setting.test(d.frontMatter)) return [];
        for (const c of d.chunks) {
          if (hasOption(c, 'cache', 'freeze') || setting.test(c.header)) return [];
          if (/(^|[^A-Za-z0-9_.])cache\s*=/.test(c.code)) return [];
        }
      }
      return [
        {
          id: 'quarto-caching',
          severity: 'recommended',
          category: 'performance',
          file: docs.find((d) => d.chunks.length > 0)?.file,
          message: `No caching configured for ${total} R chunks: no cache: or freeze: setting found`,
          suggestions: [
            'Set freeze: auto under execute: in _quarto.yml so unchanged documents are not re-run',
            'Use #| cache: true on chunks with expensive computations',
          ],
          details: `${total} R chunks across ${docs.length} .qmd file(s); no cache/freeze in YAML or chunk options`,
        },
      ];
    },
  },
  {
    id: 'quarto-text',
    workflows: ['quarto'],
    async run({ dirPath }) {
      const docs = await loadDocs(dirPath, /\.qmd$/);
      const sparse = docs.filter((d) => d.chunks.length >= 2 && d.narrative.length < 3);
      if (sparse.length === 0) return [];
      return [
        {
          id: 'quarto-text',
          severity: 'recommended',
          category: 'documentation',
          file: sparse[0].file,
          message: `Consider adding narrative text to ${sparse[0].name}: it has ${sparse[0].chunks.length} code chunks but almost no prose`,
          suggestions: [
            'Explain the purpose of each analysis step and interpret results between code chunks',
          ],
          details: `Files with 2+ R chunks and fewer than 3 narrative lines: ${summarize(sparse.map((d) => d.name))}`,
        },
      ];
    },
  },
  {
    id: 'quarto-figures',
    workflows: ['quarto'],
    async run({ dirPath }) {
      const docs = await loadDocs(dirPath, /\.qmd$/);
      const hits: { doc: LoadedDoc; chunk: Chunk }[] = [];
      for (const doc of docs) {
        for (const chunk of doc.chunks) {
          if (isHidden(chunk) || !PLOT_CALL.test(chunk.code)) continue;
          if (hasOption(chunk, 'fig-cap') || /fig[.-]cap\s*=/.test(chunk.header)) continue;
          hits.push({ doc, chunk });
        }
      }
      if (hits.length === 0) return [];
      return [
        {
          id: 'quarto-figures',
          severity: 'recommended',
          category: 'documentation',
          file: hits[0].doc.file,
          line: hits[0].chunk.line,
          message: 'Consider adding #| fig-cap to chunks that produce plots',
          suggestions: [
            'Add #| label: fig-name and #| fig-cap: "Description of the figure" at the top of the chunk',
          ],
          details: `Plot chunks without fig-cap: ${summarize(hits.map((h) => `${h.doc.name}:${h.chunk.line}`))}`,
        },
      ];
    },
  },
  {
    id: 'quarto-tables',
    workflows: ['quarto'],
    async run({ dirPath }) {
      const docs = await loadDocs(dirPath, /\.qmd$/);
      const hits: { doc: LoadedDoc; chunk: Chunk }[] = [];
      for (const doc of docs) {
        for (const chunk of doc.chunks) {
          if (isHidden(chunk) || !TABLE_CALL.test(chunk.code)) continue;
          if (hasOption(chunk, 'tbl-cap') || /tbl[.-]cap\s*=/.test(chunk.header)) continue;
          // kable(caption = "...") is accepted; captions of labs()/ggtitle() are plot captions
          if (/(^|[^A-Za-z0-9_.])caption\s*=/.test(removeCalls(chunk.code, PLOT_LABEL_CALL))) {
            continue;
          }
          hits.push({ doc, chunk });
        }
      }
      if (hits.length === 0) return [];
      return [
        {
          id: 'quarto-tables',
          severity: 'recommended',
          category: 'structure',
          file: hits[0].doc.file,
          line: hits[0].chunk.line,
          message: 'Consider adding #| tbl-cap to chunks that produce tables',
          suggestions: [
            'Add #| label: tbl-name and #| tbl-cap: "Description of the table" at the top of the chunk',
          ],
          details: `Table chunks without tbl-cap: ${summarize(hits.map((h) => `${h.doc.name}:${h.chunk.line}`))}`,
        },
      ];
    },
  },
];
