import path from 'path';
import { RuleDef } from './types.js';
import { findFiles, readText } from './helpers.js';

const SNAKE = /^[a-z][a-z0-9_]*$/;
const TARGET_CALL = /(?:^|[^\w.])tar_target\(\s*(?:name\s*=\s*)?([A-Za-z._][A-Za-z0-9._]*)\s*[,)]/g;

function suggest(name: string): string {
  const s = name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return /^[a-z]/.test(s) ? s : `x_${s}`;
}

export const targetsRules: RuleDef[] = [
  {
    id: 'targets-naming',
    workflows: ['targets'],
    async run({ dirPath }) {
      const files = [
        path.join(dirPath, '_targets.R'),
        ...(await findFiles(path.join(dirPath, 'R'), /\.[Rr]$/)),
      ];
      const bad: { name: string; file: string; line: number }[] = [];
      for (const file of files) {
        const content = await readText(file);
        if (content === null) continue;
        content.split(/\r?\n/).forEach((line, idx) => {
          if (line.trimStart().startsWith('#')) return;
          for (const m of line.matchAll(TARGET_CALL)) {
            if (!SNAKE.test(m[1])) bad.push({ name: m[1], file, line: idx + 1 });
          }
        });
      }
      if (bad.length === 0) return [];
      const names = [...new Set(bad.map((b) => b.name))];
      return [
        {
          id: 'targets-naming',
          severity: 'recommended',
          category: 'naming',
          message: `${names.length} target name(s) are not snake_case`,
          file: bad[0].file,
          line: bad[0].line,
          details: `Non-snake_case targets: ${names.slice(0, 5).join(', ')}${
            names.length > 5 ? ', ...' : ''
          }`,
          suggestions: [
            `Rename ${names[0]} to snake_case (e.g. ${suggest(names[0])}) and update every reference to it`,
            'Use lowercase letters, digits and underscores only, starting with a letter',
          ],
        },
      ];
    },
  },
];
