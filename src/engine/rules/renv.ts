import { RuleDef } from './types.js';
import { pathExists } from './helpers.js';

export const renvRules: RuleDef[] = [
  {
    id: 'renv-lock',
    workflows: ['renv'],
    async run({ dirPath, fsys }) {
      if (await pathExists(fsys, `${dirPath}/renv.lock`)) return [];
      return [
        {
          id: 'renv-lock',
          severity: 'critical',
          category: 'structure',
          message: 'renv project must have renv.lock file',
          suggestions: ['Run renv::init() to create renv.lock'],
        },
      ];
    },
  },
  {
    id: 'renv-init',
    workflows: ['renv'],
    async run({ dirPath, fsys }) {
      if (!(await pathExists(fsys, fsys.join(dirPath, 'renv.lock')))) return [];
      if (await pathExists(fsys, fsys.join(dirPath, 'renv', 'activate.R'))) return [];
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
