import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  analyseUpload,
  validateUploadBody,
  PreparedProject,
} from '../../src/engine/browser-upload';
import { nodeProjectFs } from '../../src/engine/project-fs-node';
import { UploadError } from '../../src/engine/upload-sanitize';

/**
 * The browser upload analysis and the server's must give identical results for the same files.
 * The server side writes the files to a temp folder and reads them from disk; the browser side keeps
 * them in memory. Both go through the same analysis (analyseUpload).
 */
const EXAMPLES = path.resolve(__dirname, '../../examples');

function readUpload(dir: string, prefix = ''): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...readUpload(path.join(dir, entry.name), rel));
    else if (entry.isFile())
      out.push({ path: rel, content: fs.readFileSync(path.join(dir, entry.name), 'utf-8') });
  }
  return out;
}

/** Server side: write the sanitised files to a fresh temp folder and analyse it from disk. */
async function analyseOnDisk(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return analyseUpload(body, async (files): Promise<PreparedProject> => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rbp-upload-parity-'));
    for (const file of files) {
      const full = path.join(root, file.path);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, file.content, 'utf-8');
    }
    return {
      fsys: nodeProjectFs,
      root,
      cleanup: () => fs.promises.rm(root, { recursive: true, force: true }),
    };
  });
}

/** Timing fields differ between runs; everything else must be identical. */
function comparable(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(value, (key, v) => (key === 'duration' || key === 'timestamp' ? undefined : v))
  );
}

const cases: Array<{ name: string; body: Record<string, unknown> }> = [
  ...fs.readdirSync(EXAMPLES).map((name) => ({
    name: `${name} (auto)`,
    body: { files: readUpload(path.join(EXAMPLES, name)) },
  })),
  ...fs.readdirSync(EXAMPLES).map((name) => ({
    name: `${name} (detect only)`,
    body: { files: readUpload(path.join(EXAMPLES, name)), detectOnly: true },
  })),
  {
    name: 'explicit workflow with severity filter',
    body: {
      files: [
        { path: 'DESCRIPTION', content: 'Package: demo\nVersion: 0.1.0\nTitle: Demo\n' },
        { path: 'R/a.R', content: 'a <- 1\n' },
      ],
      workflow: 'package',
      minSeverity: 'important',
    },
  },
  {
    name: 'nested upload with a README and an unknown project',
    body: { files: [{ path: 'notes/readme.md', content: '# Notes\n' }] },
  },
];

describe('browser upload analysis matches the server', () => {
  for (const c of cases) {
    it(c.name, async () => {
      const browser = comparable(await validateUploadBody(c.body));
      const server = comparable(await analyseOnDisk(c.body));
      expect(browser).toEqual(server);
    });
  }

  it('the comparison is not vacuous: a package upload produces findings in the browser', async () => {
    const body = {
      files: [
        { path: 'DESCRIPTION', content: 'Package: demo\nVersion: 0.1.0\nTitle: Demo\n' },
        { path: 'R/a.R', content: 'a <- 1\n' },
      ],
      workflow: 'package',
    };
    const result = await validateUploadBody(body);
    expect((result.findings as unknown[]).length).toBeGreaterThan(0);
  });

  it('reports the same invalid-workflow error on both sides', async () => {
    const body = { files: [{ path: 'a.R', content: 'x <- 1\n' }], workflow: 'nope' };
    await expect(validateUploadBody(body)).rejects.toMatchObject({ code: 'INVALID_WORKFLOW' });
    await expect(analyseOnDisk(body)).rejects.toBeInstanceOf(UploadError);
  });
});
