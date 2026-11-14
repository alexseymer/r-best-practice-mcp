import type { ProjectFs } from '../project-fs.js';
import { RuleDef } from './types.js';
import { anyExists, findFiles, maskRSource, pathExists, readText, stripBom } from './helpers.js';

const ATTACH_CALL = /(?:^|[^\w.:$@])(library|require)\(/m;
const DEV_FILES = [
  '.github',
  'README.Rmd',
  'cran-comments.md',
  '_pkgdown.yml',
  '.lintr',
  'codecov.yml',
];

const ROXYGEN_LINE = /^[ \t]*#'/m;

async function rSourceFiles(fsys: ProjectFs, dirPath: string): Promise<string[]> {
  return findFiles(fsys, fsys.join(dirPath, 'R'), /\.[Rr]$/, { recursive: false });
}

export const packageRules: RuleDef[] = [
  {
    id: 'pkg-readme',
    workflows: ['package'],
    async run({ dirPath, fsys }) {
      if (await anyExists(fsys, dirPath, ['README.md', 'README.Rmd'])) return [];
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
    async run({ dirPath, fsys }) {
      if (!(await pathExists(fsys, fsys.join(dirPath, 'DESCRIPTION')))) return [];
      if (await pathExists(fsys, fsys.join(dirPath, 'NAMESPACE'))) return [];
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
    async run({ dirPath, fsys }) {
      const files = await rSourceFiles(fsys, dirPath);
      if (files.length === 0) return [];
      for (const file of files) {
        const text = await readText(fsys, file);
        // Unreadable or oversized files: stay silent rather than risk a false positive.
        if (text === null || ROXYGEN_LINE.test(stripBom(text))) return [];
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
    async run({ dirPath, fsys }) {
      if (await pathExists(fsys, fsys.join(dirPath, 'vignettes'))) return [];
      const files = await rSourceFiles(fsys, dirPath);
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
  {
    id: 'pkg-library-calls',
    workflows: ['package'],
    async run({ dirPath, fsys }) {
      for (const file of await rSourceFiles(fsys, dirPath)) {
        const text = await readText(fsys, file);
        if (text === null) continue;
        const code = maskRSource(stripBom(text), true);
        const m = ATTACH_CALL.exec(code);
        if (!m) continue;
        const line = code.slice(0, m.index + m[0].indexOf(m[1])).split('\n').length;
        return [
          {
            id: 'pkg-library-calls',
            severity: 'recommended',
            category: 'dependency',
            message: `Consider pkg::fun() instead of ${m[1]}(): ${fsys.basename(file)} attaches a package`,
            file,
            line,
            suggestions: [
              'Add the package to Imports in DESCRIPTION and call it as pkg::fun()',
              "Or import single functions with #' @importFrom pkg fun",
            ],
          },
        ];
      }
      return [];
    },
  },
  {
    id: 'pkg-rbuildignore',
    workflows: ['package'],
    async run({ dirPath, fsys }) {
      if (!(await pathExists(fsys, fsys.join(dirPath, 'DESCRIPTION')))) return [];
      if (await pathExists(fsys, fsys.join(dirPath, '.Rbuildignore'))) return [];
      const rproj = await findFiles(fsys, dirPath, /\.Rproj$/, { recursive: false });
      const present: string[] = rproj.map((f) => fsys.basename(f));
      for (const name of DEV_FILES) {
        if (await pathExists(fsys, fsys.join(dirPath, name))) present.push(name);
      }
      if (present.length === 0) return [];
      return [
        {
          id: 'pkg-rbuildignore',
          severity: 'recommended',
          category: 'structure',
          message: `Package has no .Rbuildignore but contains development files (${present.slice(0, 3).join(', ')})`,
          details: present.join(', '),
          suggestions: [
            'Run usethis::use_build_ignore() for each file, or create .Rbuildignore with one regex per line',
          ],
        },
      ];
    },
  },
];
