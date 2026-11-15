import type { ProjectFs } from '../project-fs.js';
import { RuleDef } from './types.js';
import { anyExists, isDirectoryAt, pathExists } from './helpers.js';
import { Finding } from '../../types/finding.js';

/**
 * True if `dirPath` or any parent directory contains a `.git` entry.
 * The walk checks `stopAt` (inclusive) and then stops; without it, it walks to the filesystem root.
 */
export async function hasGitRepo(
  fsys: ProjectFs,
  dirPath: string,
  stopAt?: string
): Promise<boolean> {
  let current = fsys.resolve(dirPath);
  const stop = stopAt ? fsys.resolve(stopAt) : undefined;
  for (;;) {
    if (await pathExists(fsys, fsys.join(current, '.git'))) return true;
    if (stop !== undefined && current === stop) return false;
    const parent = fsys.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

export const analysisRules: RuleDef[] = [
  {
    id: 'analysis-readme',
    workflows: ['analysis'],
    async run({ dirPath, fsys }) {
      if (await anyExists(fsys, dirPath, ['README.md', 'README.Rmd', 'README'])) return [];
      return [
        {
          id: 'analysis-readme',
          severity: 'recommended',
          category: 'documentation',
          message: 'Add README.md to document the analysis',
          suggestions: ['Create README.md describing the question, data sources and how to run it'],
        },
      ];
    },
  },
  {
    id: 'analysis-structure',
    workflows: ['analysis'],
    async run({ dirPath, fsys }) {
      const out: Finding[] = [];
      for (const dir of ['data', 'R', 'output']) {
        if (await isDirectoryAt(fsys, `${dirPath}/${dir}`)) continue;
        out.push({
          id: 'analysis-structure',
          severity: 'recommended',
          category: 'structure',
          message: `Analysis project should have ${dir}/ directory`,
          suggestions: [`Create a ${dir}/ directory`],
        });
      }
      return out;
    },
  },
  {
    id: 'analysis-versioning',
    workflows: ['analysis'],
    async run({ dirPath, fsys }) {
      if (await hasGitRepo(fsys, dirPath)) return [];
      return [
        {
          id: 'analysis-versioning',
          severity: 'important',
          category: 'structure',
          message: 'Analysis is not under version control (no .git directory found)',
          suggestions: [
            'Run usethis::use_git() (or the git init command) in the project directory and commit your code',
            'Commit code, a data provenance note and renv.lock; git-ignore large or generated outputs (use Git LFS or DVC for large data)',
          ],
        },
      ];
    },
  },
];
