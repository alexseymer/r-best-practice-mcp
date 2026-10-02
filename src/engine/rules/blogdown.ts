import path from 'path';
import { RuleDef } from './types.js';
import { findFiles, readText, pathExists, anyExists } from './helpers.js';

const POST_FILE = /\.(md|Rmd|Rmarkdown)$/;

function hasFrontMatter(content: string): boolean {
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const first = text.split(/\r?\n/, 1)[0].trim();
  return first === '---' || first === '+++' || first.startsWith('{');
}

export const blogdownRules: RuleDef[] = [
  {
    id: 'blogdown-metadata',
    workflows: ['blogdown'],
    async run({ dirPath }) {
      const files = await findFiles(path.join(dirPath, 'content'), POST_FILE);
      const missing: string[] = [];
      for (const file of files) {
        const content = await readText(file);
        if (content === null || content.trim() === '') continue;
        if (!hasFrontMatter(content)) missing.push(file);
      }
      if (missing.length === 0) return [];
      const names = missing.slice(0, 5).map((f) => path.relative(dirPath, f));
      return [
        {
          id: 'blogdown-metadata',
          severity: 'important',
          category: 'documentation',
          message: `${missing.length} content file(s) have no front matter`,
          file: missing[0],
          line: 1,
          details: `Files without front matter: ${names.join(', ')}${
            missing.length > 5 ? ', ...' : ''
          }`,
          suggestions: [
            'Start each post with a YAML block (---) containing title, date, author, categories and tags',
            'Use blogdown::new_post() to create posts with the correct front matter',
          ],
        },
      ];
    },
  },
  {
    id: 'blogdown-deployment',
    workflows: ['blogdown'],
    async run({ dirPath }) {
      if (
        await anyExists(dirPath, ['netlify.toml', 'vercel.json', 'render.yaml', '.gitlab-ci.yml'])
      ) {
        return [];
      }
      if (await pathExists(path.join(dirPath, '.netlify'))) return [];
      const workflows = await findFiles(path.join(dirPath, '.github', 'workflows'), /./, {
        includeHidden: true,
      });
      if (workflows.length > 0) return [];
      return [
        {
          id: 'blogdown-deployment',
          severity: 'recommended',
          category: 'structure',
          message: 'No deployment configuration found for the site',
          suggestions: [
            'Add netlify.toml with the build command (hugo) and publish directory (public)',
            'Or add a GitHub Actions workflow in .github/workflows/ that builds and publishes the site',
          ],
        },
      ];
    },
  },
];
