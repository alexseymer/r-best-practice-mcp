import path from 'path';
import { RuleDef } from './types.js';
import { findFiles, readText, anyExists } from './helpers.js';

// `content/` is the search root, so a root-level public/ (build output) is never reached; nested
// sections such as content/docs/ are legitimate Hugo content and must be checked.
const CONTENT_SKIPPED_DIRS = ['node_modules', '.git', 'resources'];

const HUGO_CONFIGS = [
  'config.toml',
  'config.yaml',
  'config.yml',
  'config.json',
  'hugo.toml',
  'hugo.yaml',
  'hugo.yml',
  'hugo.json',
];
const PUBLISH_DIR = /^\s*["']?publishDir["']?\s*[:=]/im;

async function hasPublishDir(dirPath: string): Promise<boolean> {
  const files = [
    ...HUGO_CONFIGS.map((n) => path.join(dirPath, n)),
    ...(await findFiles(path.join(dirPath, 'config'), /\.(toml|ya?ml|json)$/i)),
  ];
  for (const file of files) {
    const text = await readText(file);
    if (text !== null && PUBLISH_DIR.test(text)) return true;
  }
  return false;
}

const POST_FILE = /\.(md|Rmd|Rmarkdown)$/;

function hasFrontMatter(content: string): boolean {
  // trimStart drops a BOM and any leading blank lines/whitespace.
  const first = content.trimStart().split(/\r?\n/, 1)[0].trim();
  return first === '---' || first === '+++' || first.startsWith('{');
}

export const blogdownRules: RuleDef[] = [
  {
    id: 'blogdown-metadata',
    workflows: ['blogdown'],
    async run({ dirPath }) {
      const files = await findFiles(path.join(dirPath, 'content'), POST_FILE, {
        skipDirs: CONTENT_SKIPPED_DIRS,
      });
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
        await anyExists(dirPath, [
          'netlify.toml',
          'vercel.json',
          'render.yaml',
          '.gitlab-ci.yml',
          '.travis.yml',
          'azure-pipelines.yml',
          '.netlify',
          path.join('.circleci', 'config.yml'),
        ])
      ) {
        return [];
      }
      if (await hasPublishDir(dirPath)) return [];
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
            'Or add a GitHub Actions workflow in .github/workflows/ (or another CI config such as .gitlab-ci.yml) that builds and publishes the site',
          ],
        },
      ];
    },
  },
];
