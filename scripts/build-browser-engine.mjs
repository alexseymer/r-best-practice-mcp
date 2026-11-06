#!/usr/bin/env node
/**
 * Copies the browser-safe engine modules from dist/ to dist/browser-engine/, keeping their folder
 * layout so the relative imports still resolve. The server serves that folder at /browser-engine/,
 * and the dashboard imports engine/browser-upload.js from there, so uploads are analysed in the
 * visitor's browser. Only the directories the browser modules import from are copied, and only
 * compiled .js files.
 */
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';

const DIST = 'dist';
const OUT = join(DIST, 'browser-engine');
const DIRECTORIES = ['engine', 'types', 'utils', 'config'];

if (!existsSync(join(DIST, 'engine', 'browser-upload.js'))) {
  console.error('dist/engine/browser-upload.js is missing: run "tsc" first');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
for (const dir of DIRECTORIES) {
  cpSync(join(DIST, dir), join(OUT, dir), {
    recursive: true,
    filter: (src) => statSync(src).isDirectory() || src.endsWith('.js'),
  });
}

const copied = DIRECTORIES.map((dir) => countJs(join(OUT, dir))).reduce((a, b) => a + b, 0);
console.log(`Browser engine: ${copied} modules in ${OUT}`);

function countJs(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((n, entry) => {
    const full = join(dir, entry.name);
    return n + (entry.isDirectory() ? countJs(full) : entry.name.endsWith('.js') ? 1 : 0);
  }, 0);
}
