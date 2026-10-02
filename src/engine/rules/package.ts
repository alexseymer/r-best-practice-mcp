import { RuleDef } from './types.js';
import { anyExists } from './helpers.js';

export const packageRules: RuleDef[] = [
  {
    id: 'pkg-readme',
    workflows: ['package'],
    async run({ dirPath }) {
      if (await anyExists(dirPath, ['README.md', 'README.Rmd'])) return [];
      return [
        {
          id: 'pkg-readme',
          severity: 'recommended',
          category: 'documentation',
          message: 'Package has no README.md',
          suggestions: [
            'Add README.md (or README.Rmd) describing what the package does and how to install it',
          ],
        },
      ];
    },
  },
];
