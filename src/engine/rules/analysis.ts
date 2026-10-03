import path from 'path';
import { RuleDef } from './types.js';
import { pathExists } from './helpers.js';

/**
 * True if `dirPath` or any parent directory contains a `.git` entry.
 * The walk checks `stopAt` (inclusive) and then stops; without it, it walks to the filesystem root.
 */
export async function hasGitRepo(dirPath: string, stopAt?: string): Promise<boolean> {
  let current = path.resolve(dirPath);
  const stop = stopAt ? path.resolve(stopAt) : undefined;
  for (;;) {
    if (await pathExists(path.join(current, '.git'))) return true;
    if (stop !== undefined && current === stop) return false;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

export const analysisRules: RuleDef[] = [
  {
    id: 'analysis-versioning',
    workflows: ['analysis'],
    async run({ dirPath }) {
      if (await hasGitRepo(dirPath)) return [];
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
