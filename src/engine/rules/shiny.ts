import fs from 'fs';
import path from 'path';
import { RuleDef } from './types.js';
import { findFiles, pathExists, readText } from './helpers.js';

const TOP_LEVEL_FILES = ['app.R', 'server.R', 'ui.R', 'global.R'];

interface SourceFile {
  file: string;
  text: string;
  /** Text without full-line and trailing comments, for keyword matching. */
  code: string;
}

function stripComments(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s#[^"'\r\n]*$/, ''))
    .join('\n');
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Shiny source: app.R, server.R, ui.R, global.R and R/*.R inside the project. */
async function loadShinySources(dirPath: string): Promise<SourceFile[]> {
  const files: string[] = [];
  for (const name of TOP_LEVEL_FILES) {
    const full = path.join(dirPath, name);
    if (await pathExists(full)) files.push(full);
  }
  files.push(...(await findFiles(path.join(dirPath, 'R'), /\.[Rr]$/)));

  const sources: SourceFile[] = [];
  for (const file of files) {
    const text = await readText(file);
    if (text !== null) sources.push({ file, text, code: stripComments(text) });
  }
  return sources;
}

const VALIDATION_PATTERNS = [
  /\breq\(/,
  /\bvalidate\w*\(/,
  /\bneed\(/,
  /InputValidator/,
  /shinyFeedback/,
];

export const shinyRules: RuleDef[] = [
  {
    id: 'shiny-validation',
    workflows: ['shiny'],
    async run({ dirPath }) {
      const sources = await loadShinySources(dirPath);
      const usesInput = sources.filter((s) => /\binput(\$|\[\[)/.test(s.code));
      if (usesInput.length === 0) return [];
      const hasValidation = sources.some((s) => VALIDATION_PATTERNS.some((p) => p.test(s.code)));
      if (hasValidation) return [];
      return [
        {
          id: 'shiny-validation',
          severity: 'recommended',
          category: 'structure',
          file: usesInput[0].file,
          message:
            'Consider validating user inputs: the app reads input values but never uses req(), validate()/need(), shinyvalidate or shinyFeedback',
          details: `Files reading input: ${usesInput
            .slice(0, 5)
            .map((s) => path.relative(dirPath, s.file))
            .join(', ')}. This is a heuristic based on keyword search.`,
          suggestions: [
            'Guard reactives and outputs with req(input$x) so they wait for valid input',
            'Use validate(need(input$n > 0, "Choose a positive number")) to show a friendly message instead of an error',
            'For form-style validation use shinyvalidate::InputValidator or shinyFeedback',
          ],
        },
      ];
    },
  },
  {
    id: 'shiny-modules',
    workflows: ['shiny'],
    async run({ dirPath }) {
      const sources = await loadShinySources(dirPath);
      const total = sources.reduce((sum, s) => sum + countLines(s.text), 0);
      if (total <= 300) return [];
      if (sources.some((s) => /\b(moduleServer|callModule)\(/.test(s.code))) return [];
      return [
        {
          id: 'shiny-modules',
          severity: 'recommended',
          category: 'structure',
          file: sources[0].file,
          message: `Consider using Shiny modules: the app source has ${total} lines but no moduleServer() or callModule()`,
          details:
            'Counted lines in app.R, server.R, ui.R, global.R and R/*.R. This is a heuristic based on size.',
          suggestions: [
            'Extract self-contained parts of the UI and server into module functions (xxxUI(id) and xxxServer(id) using moduleServer())',
            'Keep each module in its own file under R/ and call it from app.R',
          ],
        },
      ];
    },
  },
  {
    id: 'shiny-separation',
    workflows: ['shiny'],
    async run({ dirPath }) {
      const appFile = path.join(dirPath, 'app.R');
      const text = await readText(appFile);
      if (text === null) return [];
      const lines = countLines(text);
      if (lines <= 200) return [];
      const code = stripComments(text);
      if (!/^\s*ui\s*(<-|=)/m.test(code) || !/^\s*server\s*(<-|=)/m.test(code)) return [];
      if (await isDir(path.join(dirPath, 'R'))) return [];
      if (
        (await pathExists(path.join(dirPath, 'ui.R'))) ||
        (await pathExists(path.join(dirPath, 'server.R')))
      ) {
        return [];
      }
      if (/\bsource\(/.test(code)) return [];
      return [
        {
          id: 'shiny-separation',
          severity: 'recommended',
          category: 'structure',
          file: appFile,
          message: `Consider splitting app.R (${lines} lines) into separate UI and server code`,
          details:
            'app.R defines both ui and server, has more than 200 lines, and there is no R/ directory, ui.R/server.R or source() call. This is a heuristic based on size.',
          suggestions: [
            'Move the UI into ui.R and the server function into server.R (or into R/ui.R and R/server.R)',
            'Or put helpers and modules in R/ (sourced automatically by Shiny 1.5+) and keep app.R short',
          ],
        },
      ];
    },
  },
];
