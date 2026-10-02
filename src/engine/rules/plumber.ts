import path from 'path';
import { RuleDef } from './types.js';
import { findFiles, readText } from './helpers.js';

const ENDPOINT = /^\s*#\*\s*@(get|post|put|delete|patch|head)\b[ \t]*(\S*)/i;
const PLUMBER_COMMENT = /^\s*#\*/;
const VERB_PREFIX = /^(get|create|delete|update|set|add|remove)([A-Z_-])/;

interface Endpoint {
  file: string;
  line: number;
  method: string;
  route: string;
  documented: boolean;
}

interface PlumberFile {
  file: string;
  endpoints: Endpoint[];
}

function parseEndpoints(file: string, text: string): Endpoint[] {
  const lines = text.split(/\r?\n/);
  const endpoints: Endpoint[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!PLUMBER_COMMENT.test(lines[i])) {
      i++;
      continue;
    }
    // Contiguous block of #* lines.
    const start = i;
    while (i < lines.length && PLUMBER_COMMENT.test(lines[i])) i++;
    const block = lines.slice(start, i);
    const documented = block.some((l) => {
      const body = l.replace(/^\s*#\*/, '').trim();
      return body.length > 0 && !body.startsWith('@');
    });
    block.forEach((l, idx) => {
      const m = ENDPOINT.exec(l);
      if (m) {
        endpoints.push({
          file,
          line: start + idx + 1,
          method: m[1].toLowerCase(),
          route: m[2],
          documented,
        });
      }
    });
  }
  return endpoints;
}

async function loadPlumberFiles(dirPath: string): Promise<PlumberFile[]> {
  const files = await findFiles(dirPath, /\.[Rr]$/);
  const out: PlumberFile[] = [];
  for (const file of files) {
    const text = await readText(file);
    if (text === null || !text.includes('#*')) continue;
    const endpoints = parseEndpoints(file, text);
    if (endpoints.length > 0) out.push({ file, endpoints });
  }
  return out;
}

function stripComments(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

function pathIssue(route: string): boolean {
  // Dynamic segments like <id> or <id:int> and {} placeholders are fine.
  const stripped = route.replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '');
  if (/[A-Z_]/.test(stripped)) return true;
  const first = stripped.split('/').find((s) => s.length > 0) ?? '';
  return VERB_PREFIX.test(first);
}

export const plumberRules: RuleDef[] = [
  {
    id: 'plumber-docs',
    workflows: ['plumber'],
    async run({ dirPath }) {
      const files = await loadPlumberFiles(dirPath);
      const undocumented = files.flatMap((f) => f.endpoints).filter((e) => !e.documented);
      if (undocumented.length === 0) return [];
      const first = undocumented[0];
      const list = undocumented
        .slice(0, 5)
        .map(
          (e) =>
            `${path.relative(dirPath, e.file)}:${e.line} (${e.method.toUpperCase()} ${e.route})`
        )
        .join(', ');
      return [
        {
          id: 'plumber-docs',
          severity: 'recommended',
          category: 'documentation',
          file: first.file,
          line: first.line,
          message: `Consider documenting ${undocumented.length} endpoint(s): the #* annotation block has no description line`,
          details: `Undocumented: ${list}. A description is a #* line that does not start with @ in the same comment block as the endpoint annotation.`,
          suggestions: [
            'Add a plain description line such as "#* Return the current server time" above the @get/@post annotation',
            'Document inputs with "#* @param name Description" so they appear in the generated OpenAPI docs',
          ],
        },
      ];
    },
  },
  {
    id: 'plumber-paths',
    workflows: ['plumber'],
    async run({ dirPath }) {
      const files = await loadPlumberFiles(dirPath);
      const bad = files
        .flatMap((f) => f.endpoints)
        .filter((e) => e.route.length > 0 && pathIssue(e.route));
      if (bad.length === 0) return [];
      const first = bad[0];
      const paths = Array.from(new Set(bad.map((e) => e.route))).slice(0, 5);
      return [
        {
          id: 'plumber-paths',
          severity: 'recommended',
          category: 'structure',
          file: first.file,
          line: first.line,
          message: 'Consider RESTful paths: lowercase nouns without underscores or verb prefixes',
          details: `Paths flagged: ${paths.join(', ')}. Flagged when a path has an uppercase letter or underscore, or its first segment is a verb such as get_, createX or delete-. Dynamic <id> segments are ignored.`,
          suggestions: [
            'Name resources with lowercase nouns, e.g. /users instead of /getUsers or /Get_Users',
            'Express the action with the HTTP method (@get, @post, @delete) instead of a verb in the path, and use hyphens for multi-word segments',
          ],
        },
      ];
    },
  },
  {
    id: 'plumber-status',
    workflows: ['plumber'],
    async run({ dirPath }) {
      const files = await loadPlumberFiles(dirPath);
      if (files.length === 0) return [];
      const allR = await findFiles(dirPath, /\.[Rr]$/);
      for (const file of allR) {
        const text = await readText(file);
        if (
          text !== null &&
          /\bres(\$status|\[\[\s*["']status["']\s*\]\])/.test(stripComments(text))
        ) {
          return [];
        }
      }
      const first = files[0].endpoints[0];
      return [
        {
          id: 'plumber-status',
          severity: 'recommended',
          category: 'structure',
          file: first.file,
          line: first.line,
          message: 'Consider setting HTTP status codes: no endpoint code uses res$status',
          details:
            'The API defines endpoints but no R file assigns res$status, so every response is 200 OK, including failures. This is a heuristic based on keyword search.',
          suggestions: [
            'Set res$status <- 400 (bad input), 404 (not found) or 500 (server error) before returning an error body',
            'Add `res` as an endpoint argument: function(req, res) { ... }',
          ],
        },
      ];
    },
  },
];
