import { RuleDef } from './types.js';
import { findFiles, readText } from './helpers.js';
import {
  Chunk,
  callsOptsChunkSet,
  hasHeaderOption,
  hasOptionLine,
  headerBody,
  loadDocs,
  summarize,
} from './quarto.js';

function isLabeled(chunk: Chunk): boolean {
  const body = headerBody(chunk.header);
  if (/(^|[\s,])label\s*=/.test(body)) return true;
  if (chunk.optionKeys.includes('label')) return true;
  const first = body.split(',')[0].trim();
  return first !== '' && !first.includes('=');
}

export const rmarkdownRules: RuleDef[] = [
  {
    id: 'rmd-chunks',
    workflows: ['rmarkdown'],
    async run({ dirPath }) {
      const docs = await loadDocs(dirPath, /\.Rmd$/);
      const hits: { file: string; name: string; line: number }[] = [];
      for (const doc of docs) {
        for (const chunk of doc.chunks) {
          if (!isLabeled(chunk)) hits.push({ file: doc.file, name: doc.name, line: chunk.line });
        }
      }
      if (hits.length === 0) return [];
      return [
        {
          id: 'rmd-chunks',
          severity: 'recommended',
          category: 'structure',
          file: hits[0].file,
          line: hits[0].line,
          message: `${hits.length} code chunk(s) have no label`,
          suggestions: ['Name each chunk, e.g. ```{r load-data} or ```{r load-data, echo=FALSE}'],
          details: `Unlabeled chunks: ${summarize(hits.map((h) => `${h.name}:${h.line}`))}`,
        },
      ];
    },
  },
  {
    id: 'rmd-chunk-options',
    workflows: ['rmarkdown'],
    async run({ dirPath }) {
      const docs = await loadDocs(dirPath, /\.Rmd$/);
      const chunks = docs.flatMap((d) => d.chunks);
      if (chunks.length === 0) return [];
      for (const chunk of chunks) {
        if (hasHeaderOption(chunk) || hasOptionLine(chunk) || callsOptsChunkSet(chunk.code)) {
          return [];
        }
      }
      // opts_chunk$set() may live in a sourced setup script
      const scripts = await findFiles(dirPath, /\.[Rr]$/);
      for (const script of scripts) {
        const text = await readText(script);
        if (text !== null && /opts_chunk\$set\s*\(/.test(text)) return [];
      }
      return [
        {
          id: 'rmd-chunk-options',
          severity: 'recommended',
          category: 'structure',
          file: docs.find((d) => d.chunks.length > 0)?.file,
          line: chunks[0].line,
          message:
            'Consider setting chunk options: no knitr::opts_chunk$set() call and no echo/eval/include/warning/message/fig.* option found',
          suggestions: [
            'Add a setup chunk with knitr::opts_chunk$set(echo = FALSE, warning = FALSE, message = FALSE)',
            'Or set options on individual chunks, e.g. ```{r load-data, include=FALSE}',
          ],
          details: `${chunks.length} R chunk(s) in ${docs.length} .Rmd file(s) use only default knitr options`,
        },
      ];
    },
  },
];
