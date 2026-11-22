import type { ProjectFs } from '../project-fs.js';
import { RuleDef } from './types.js';
import type { Finding } from '../../types/finding.js';
import {
  anyExists,
  findFiles,
  isDirectoryAt,
  maskRSource,
  pathExists,
  readText,
  stripBom,
} from './helpers.js';

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

/** Full value of a DESCRIPTION field, including its indented continuation lines. */
function fieldValue(desc: string, field: string): string | undefined {
  const match = new RegExp(`^${field}:[ \\t]*(.*(?:\\r?\\n[ \\t]+.*)*)`, 'm').exec(desc.replace(/\r/g, ''));
  return match ? match[1].replace(/\s*\n\s*/g, ' ').trim() : undefined;
}

const TITLE_MAX_LENGTH = 65;

/**
 * Content checks from R Packages (description.html): the Title is a short plain title without a full
 * stop, and the Description ends as a sentence. Title case is not checked. Reported under the same id
 * at recommended severity, because a missing or wrong wording does not break the package.
 */
function descriptionStyleFindings(desc: string): Finding[] {
  const out: Finding[] = [];
  const title = fieldValue(desc, 'Title') ?? '';
  const description = fieldValue(desc, 'Description') ?? '';
  const add = (message: string, suggestion: string) =>
    out.push({
      id: 'pkg-description',
      severity: 'recommended',
      category: 'structure',
      message,
      suggestions: [suggestion],
    });

  if (title === '') {
    add('Consider filling in the Title field', 'Write a short title in plain text, for example "Tools for Tidy Data"');
  } else {
    if (title.endsWith('.')) add('Consider removing the full stop at the end of Title', 'Titles have no trailing full stop');
    if (title.length > TITLE_MAX_LENGTH) {
      add(
        `Consider shortening Title to ${TITLE_MAX_LENGTH} characters or fewer (${title.length} now)`,
        'Listings such as CRAN truncate longer titles',
      );
    }
    if (/^(a|an|the|this)\s+package\b/i.test(title)) {
      add('Consider a Title that says what the package does, not "A package for ..."', 'Start the title with the subject, as in "Tools for Tidy Data"');
    }
  }

  if (description !== '' && !/[.!?]$/.test(description)) {
    add('Consider ending Description with a full stop', 'Write the Description as complete sentences in one paragraph');
  }
  return out;
}

export const packageRules: RuleDef[] = [
  {
    id: 'pkg-description',
    workflows: ['package'],
    async run({ dirPath, fsys }) {
      if (!(await pathExists(fsys, `${dirPath}/DESCRIPTION`))) {
        return [
          {
            id: 'pkg-description',
            severity: 'critical',
            category: 'structure',
            message: 'Package must have DESCRIPTION file',
            suggestions: ['Run usethis::use_description() to create DESCRIPTION'],
          },
        ];
      }
      const desc = await fsys.readFile(`${dirPath}/DESCRIPTION`);
      // Required fields are matched at line start, not as substrings
      const hasField = (field: string) =>
        new RegExp(`^${field}:`, 'm').test(desc.replace(/\r/g, ''));
      const missing = ['Package', 'Version', 'Title', 'Description', 'License'].filter(
        (f) => !hasField(f)
      );
      if (!hasField('Authors@R') && !(hasField('Author') && hasField('Maintainer'))) {
        missing.push('Authors@R (or both Author and Maintainer)');
      }
      if (missing.length > 0) {
        return [
          {
            id: 'pkg-description',
            severity: 'critical',
            category: 'structure',
            message: `DESCRIPTION missing required field(s): ${missing.join(', ')}`,
            suggestions: [
              'Add the missing fields to DESCRIPTION',
              'Use usethis::use_description() to generate a complete DESCRIPTION',
            ],
          },
        ];
      }
      return descriptionStyleFindings(desc);
    },
  },
  {
    id: 'pkg-structure',
    workflows: ['package'],
    async run({ dirPath, fsys }) {
      if (!(await pathExists(fsys, `${dirPath}/DESCRIPTION`))) return [];
      if (await isDirectoryAt(fsys, `${dirPath}/R`)) return [];
      return [
        {
          id: 'pkg-structure',
          severity: 'important',
          category: 'structure',
          message: 'Package should have R/ directory for source files',
          suggestions: ['Create an R/ directory and move source files into it'],
        },
      ];
    },
  },
  {
    id: 'pkg-tests',
    workflows: ['package'],
    async run({ dirPath, fsys }) {
      if (!(await pathExists(fsys, `${dirPath}/DESCRIPTION`))) return [];
      if (await isDirectoryAt(fsys, `${dirPath}/tests/testthat`)) return [];
      return [
        {
          id: 'pkg-tests',
          severity: 'important',
          category: 'testing',
          message: 'Add tests/testthat/ with testthat tests',
          suggestions: ['Create tests/testthat/ directory (usethis::use_testthat(3))', 'Add test_*.R files'],
        },
      ];
    },
  },
  {
    id: 'pkg-license',
    workflows: ['package'],
    async run({ dirPath, fsys }) {
      if (!(await pathExists(fsys, `${dirPath}/DESCRIPTION`))) return [];
      const desc = await fsys.readFile(`${dirPath}/DESCRIPTION`);
      const licenseMatch = /^License:[ \t]*(.*(?:\r?\n[ \t]+.*)*)/m.exec(desc);
      if (!licenseMatch) {
        return [
          {
            id: 'pkg-license',
            severity: 'critical',
            category: 'structure',
            message: 'DESCRIPTION must declare a License field',
            suggestions: [
              'Add a License: field to DESCRIPTION',
              'Run usethis::use_mit_license() or another usethis::use_*_license() helper',
            ],
          },
        ];
      }
      if (!/file\s+LICEN[CS]E/.test(licenseMatch[1])) return [];
      if (await anyExists(fsys, dirPath, ['LICENSE', 'LICENSE.md', 'LICENCE', 'LICENCE.md'])) {
        return [];
      }
      return [
        {
          id: 'pkg-license',
          severity: 'critical',
          category: 'structure',
          message: 'DESCRIPTION references "file LICENSE" but no LICENSE file exists',
          suggestions: [
            'Create the LICENSE file referenced by DESCRIPTION',
            'Or use a standard license such as License: MIT + file LICENSE via usethis::use_mit_license()',
          ],
        },
      ];
    },
  },
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
