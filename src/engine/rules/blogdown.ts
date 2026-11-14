import type { ProjectFs } from '../project-fs.js';
import { RuleDef } from './types.js';
import { anyExists, findFiles, isDirectoryAt, readText } from './helpers.js';

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

async function hasPublishDir(fsys: ProjectFs, dirPath: string): Promise<boolean> {
  const files = [
    ...HUGO_CONFIGS.map((n) => fsys.join(dirPath, n)),
    ...(await findFiles(fsys, fsys.join(dirPath, 'config'), /\.(toml|ya?ml|json)$/i)),
  ];
  for (const file of files) {
    const text = await readText(fsys, file);
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
    id: 'blogdown-config',
    workflows: ['blogdown'],
    async run({ dirPath, fsys }) {
      // Hugo accepts several config names and a config directory
      if (await isDirectoryAt(fsys, `${dirPath}/config/_default`)) return [];
      const names = [
        'config.toml',
        'config.yaml',
        'config.yml',
        'hugo.toml',
        'hugo.yaml',
        'hugo.yml',
        'config.json',
        'hugo.json',
      ];
      if (await anyExists(fsys, dirPath, names)) return [];
      return [
        {
          id: 'blogdown-config',
          severity: 'critical',
          category: 'structure',
          message:
            'Blogdown site must have a Hugo config (config.toml, hugo.toml, config.yaml, ... or config/_default/)',
          suggestions: ['Create config.toml with site configuration'],
        },
      ];
    },
  },
  {
    id: 'blogdown-content-structure',
    workflows: ['blogdown'],
    async run({ dirPath, fsys }) {
      if (await isDirectoryAt(fsys, `${dirPath}/content`)) return [];
      return [
        {
          id: 'blogdown-content-structure',
          severity: 'important',
          category: 'structure',
          message: 'Blogdown site should have content/ directory',
          suggestions: ['Create a content/ directory for posts and pages'],
        },
      ];
    },
  },
  {
    id: 'blogdown-theme',
    workflows: ['blogdown'],
    async run({ dirPath, fsys }) {
      if (await isDirectoryAt(fsys, `${dirPath}/themes`)) return [];
      return [
        {
          id: 'blogdown-theme',
          severity: 'recommended',
          category: 'structure',
          message: 'Blogdown site should have themes/ directory for custom theme',
          suggestions: ['Install a Hugo theme, e.g. blogdown::install_theme()'],
        },
      ];
    },
  },
  {
    id: 'blogdown-metadata',
    workflows: ['blogdown'],
    async run({ dirPath, fsys }) {
      const files = await findFiles(fsys, fsys.join(dirPath, 'content'), POST_FILE, {
        skipDirs: CONTENT_SKIPPED_DIRS,
      });
      const missing: string[] = [];
      for (const file of files) {
        const content = await readText(fsys, file);
        if (content === null || content.trim() === '') continue;
        if (!hasFrontMatter(content)) missing.push(file);
      }
      if (missing.length === 0) return [];
      const names = missing.slice(0, 5).map((f) => fsys.relative(dirPath, f));
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
    async run({ dirPath, fsys }) {
      if (
        await anyExists(fsys, dirPath, [
          'netlify.toml',
          'vercel.json',
          'render.yaml',
          '.gitlab-ci.yml',
          '.travis.yml',
          'azure-pipelines.yml',
          '.netlify',
          fsys.join('.circleci', 'config.yml'),
        ])
      ) {
        return [];
      }
      if (await hasPublishDir(fsys, dirPath)) return [];
      const workflows = await findFiles(fsys, fsys.join(dirPath, '.github', 'workflows'), /./, {
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
