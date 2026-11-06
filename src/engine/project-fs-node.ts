import fs from 'fs';
import path from 'path';
import type { ProjectFs } from './project-fs.js';

/** The server's disk. Keep this file the only place with Node file access for the file-system interface. */
export const nodeProjectFs: ProjectFs = {
  async readdir(dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() }));
  },
  async stat(p) {
    const s = await fs.promises.stat(p);
    return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size };
  },
  readFile: (p) => fs.promises.readFile(p, 'utf-8'),
  join: (...parts) => path.join(...parts),
  basename: (p) => path.basename(p),
  dirname: (p) => path.dirname(p),
  relative: (from, to) => path.relative(from, to),
  resolve: (p) => path.resolve(p),
};

