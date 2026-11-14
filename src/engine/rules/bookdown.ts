import { RuleDef } from './types.js';
import { anyExists, findFiles, pathExists, readText } from './helpers.js';
import { loadDocs, parseDoc, summarize } from './quarto.js';

const CHAPTER_NAME = /^\d{2}-[a-z0-9-]+\.Rmd$/;

export const bookdownRules: RuleDef[] = [
  {
    id: 'bookdown-config',
    workflows: ['bookdown'],
    async run({ dirPath, fsys }) {
      if (await anyExists(fsys, dirPath, ['_bookdown.yml', '_bookdown.yaml'])) return [];
      return [
        {
          id: 'bookdown-config',
          severity: 'important',
          category: 'structure',
          message: 'Bookdown project should have _bookdown.yml',
          suggestions: ['Create _bookdown.yml with book configuration'],
        },
      ];
    },
  },
  {
    id: 'bookdown-index',
    workflows: ['bookdown'],
    async run({ dirPath, fsys }) {
      if (await pathExists(fsys, `${dirPath}/index.Rmd`)) return [];
      return [
        {
          id: 'bookdown-index',
          severity: 'critical',
          category: 'structure',
          message: 'Bookdown book must have index.Rmd',
          suggestions: ['Create index.Rmd with the book YAML header and introduction'],
        },
      ];
    },
  },
  {
    id: 'bookdown-readme',
    workflows: ['bookdown'],
    async run({ dirPath, fsys }) {
      if (await anyExists(fsys, dirPath, ['README.md', 'README.Rmd'])) return [];
      return [
        {
          id: 'bookdown-readme',
          severity: 'recommended',
          category: 'documentation',
          message: 'Add README.md (or README.Rmd) to document the book',
          suggestions: ['Create README.md explaining how to build and contribute to the book'],
        },
      ];
    },
  },
  {
    id: 'bookdown-chapter-naming',
    workflows: ['bookdown'],
    async run({ dirPath, fsys }) {
      const files = await findFiles(fsys, dirPath, /\.Rmd$/, { recursive: false });
      // bookdown ignores files starting with "_" and README.Rmd
      const bad = files
        .map((f) => fsys.basename(f))
        .filter((n) => n !== 'index.Rmd' && n !== 'README.Rmd' && !n.startsWith('_'))
        .filter((n) => !CHAPTER_NAME.test(n));
      if (bad.length === 0) return [];
      return [
        {
          id: 'bookdown-chapter-naming',
          severity: 'recommended',
          category: 'naming',
          file: fsys.join(dirPath, bad[0]),
          message: `${bad.length} chapter file(s) do not follow the NN-title.Rmd naming convention`,
          suggestions: [
            'Rename chapters to 01-introduction.Rmd, 02-methods.Rmd, ... (two digits, lowercase, hyphens)',
          ],
          details: `Non-conforming files: ${summarize(bad)}`,
        },
      ];
    },
  },
  {
    id: 'bookdown-output-formats',
    workflows: ['bookdown'],
    async run({ dirPath, fsys }) {
      if (await anyExists(fsys, dirPath, ['_output.yml', '_output.yaml'])) return [];
      const indexPath = fsys.join(dirPath, 'index.Rmd');
      const text = await readText(fsys, indexPath);
      if (text === null) return [];
      const formats = new Set(
        parseDoc(text).frontMatter.match(/bookdown::(?!bookdown_site\b)[A-Za-z0-9_]+/g) ?? []
      );
      if (formats.size >= 2) return [];
      return [
        {
          id: 'bookdown-output-formats',
          severity: 'recommended',
          category: 'structure',
          file: indexPath,
          message: `Only ${formats.size} bookdown output format(s) configured and no _output.yml found`,
          suggestions: [
            'Create _output.yml with bookdown::gitbook and bookdown::pdf_book (optionally bookdown::epub_book)',
          ],
          details:
            'Checked for _output.yml and for bookdown:: formats in the index.Rmd YAML header',
        },
      ];
    },
  },
  {
    id: 'bookdown-cross-references',
    workflows: ['bookdown'],
    async run({ dirPath, fsys }) {
      const docs = await loadDocs(fsys, dirPath, /\.Rmd$/);
      const figureLike = /(^|[^A-Za-z0-9_.])(plot|ggplot|kable)\s*\(/;
      const withFloats: string[] = [];
      for (const doc of docs) {
        const hasFloat = doc.chunks.some(
          (c) =>
            /fig[.-]cap/.test(c.header) ||
            c.optionKeys.includes('fig-cap') ||
            figureLike.test(c.code)
        );
        if (hasFloat) withFloats.push(doc.name);
      }
      if (withFloats.length === 0) return [];
      for (const doc of docs) {
        const text = await readText(fsys, doc.file);
        if (text !== null && text.includes('\\@ref(')) return [];
      }
      return [
        {
          id: 'bookdown-cross-references',
          severity: 'recommended',
          category: 'documentation',
          file: fsys.join(dirPath, withFloats[0]),
          message:
            'Consider cross-referencing figures and tables: chapters contain them but no \\@ref() was found',
          suggestions: [
            'Give figure/table chunks labels and reference them with \\@ref(fig:label) or \\@ref(tab:label)',
          ],
          details: `Files with figures or tables: ${summarize(withFloats)}`,
        },
      ];
    },
  },
];
