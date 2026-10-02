import path from 'path';
import { RuleDef } from './types.js';
import { anyExists, findFiles, pathExists, readText } from './helpers.js';

const ROXYGEN_LINE = /^[ \t]*#'/m;

async function rSourceFiles(dirPath: string): Promise<string[]> {
  return findFiles(path.join(dirPath, 'R'), /\.[Rr]$/, { recursive: false });
}

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
  {
    id: 'pkg-namespace',
    workflows: ['package'],
    async run({ dirPath }) {
      if (!(await pathExists(path.join(dirPath, 'DESCRIPTION')))) return [];
      if (await pathExists(path.join(dirPath, 'NAMESPACE'))) return [];
      return [
        {
          id: 'pkg-namespace',
          severity: 'important',
          category: 'structure',
          message: 'Package has a DESCRIPTION but no NAMESPACE file',
          suggestions: [
            "Add roxygen2 tags (#' @export, #' @importFrom) and run devtools::document() to generate NAMESPACE",
            'Add `Roxygen: list(markdown = TRUE)` to DESCRIPTION (usethis::use_roxygen_md()) so document() manages NAMESPACE',
          ],
        },
      ];
    },
  },
  {
    id: 'pkg-roxygen',
    workflows: ['package'],
    async run({ dirPath }) {
      const files = await rSourceFiles(dirPath);
      if (files.length === 0) return [];
      for (const file of files) {
        const text = await readText(file);
        // Unreadable or oversized files: stay silent rather than risk a false positive.
        if (text === null || ROXYGEN_LINE.test(text)) return [];
      }
      return [
        {
          id: 'pkg-roxygen',
          severity: 'important',
          category: 'documentation',
          message: "No roxygen2 comments (#') found in any file under R/",
          file: files[0],
          suggestions: [
            "Document exported functions with roxygen2 comments such as #' @param, #' @return and #' @export",
            'Run devtools::document() to generate man/*.Rd and NAMESPACE',
          ],
          details: `Checked ${files.length} file(s) in R/.`,
        },
      ];
    },
  },
  {
    id: 'pkg-vignettes',
    workflows: ['package'],
    async run({ dirPath }) {
      if (await pathExists(path.join(dirPath, 'vignettes'))) return [];
      const files = await rSourceFiles(dirPath);
      if (files.length < 3) return [];
      return [
        {
          id: 'pkg-vignettes',
          severity: 'recommended',
          category: 'documentation',
          message: `Package has ${files.length} source files in R/ but no vignettes/ directory`,
          suggestions: [
            "Run usethis::use_vignette('getting-started') to add a vignette",
            'Show a typical workflow with the main functions in the vignette',
          ],
        },
      ];
    },
  },
];
