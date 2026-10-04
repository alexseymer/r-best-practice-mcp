import path from 'path';
import { RuleDef } from './types.js';
import { pathExists } from './helpers.js';

export const renvRules: RuleDef[] = [
  {
    id: 'renv-init',
    workflows: ['renv'],
    async run({ dirPath }) {
      if (!(await pathExists(path.join(dirPath, 'renv.lock')))) return [];
      if (await pathExists(path.join(dirPath, 'renv', 'activate.R'))) return [];
      return [
        {
          id: 'renv-init',
          severity: 'important',
          category: 'dependency',
          message: 'renv.lock exists but renv is not initialized/activated in this project',
          suggestions: [
            'Run renv::init() to set up the project library and renv/activate.R',
            'Run renv::activate() if the lockfile came from another checkout, then renv::restore()',
          ],
          details: 'renv/activate.R is missing, so R will not load the project library on startup.',
        },
      ];
    },
  },
];
