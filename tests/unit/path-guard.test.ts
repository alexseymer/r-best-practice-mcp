import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveAllowedPath, PATH_NOT_ALLOWED_MESSAGE } from '../../src/middleware/path-guard';
import { startTestServer, postJson, TestServer } from '../helpers/web';

let base: string; // real path of the sandbox
let root: string; // allowed root: <base>/projects
let outside: string; // <base>/secret (not allowed)

beforeAll(() => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pathguard-')));
  root = path.join(base, 'projects');
  outside = path.join(base, 'secret');
  fs.mkdirSync(path.join(root, 'proj', 'R'), { recursive: true });
  fs.mkdirSync(path.join(base, 'projects-evil'), { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(root, 'proj', 'R', 'a.R'), 'x <- 1\n');
  fs.writeFileSync(path.join(root, 'proj', 'DESCRIPTION'), 'Package: demo\n');
  fs.writeFileSync(path.join(outside, 'passwd.R'), 'secret <- 1\n');
  fs.symlinkSync(outside, path.join(root, 'escape-dir'));
  fs.symlinkSync(path.join(outside, 'passwd.R'), path.join(root, 'escape-file.R'));
  fs.symlinkSync(path.join(root, 'proj'), path.join(root, 'inside-link'));
  fs.symlinkSync(root, path.join(base, 'root-alias'));
});

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

describe('resolveAllowedPath', () => {
  it('allows the root itself and paths below it, returning the real path', async () => {
    expect(await resolveAllowedPath(root, [root])).toBe(root);
    expect(await resolveAllowedPath(path.join(root, 'proj'), [root])).toBe(path.join(root, 'proj'));
    expect(await resolveAllowedPath(path.join(root, 'proj', 'R', 'a.R'), [root])).toBe(
      path.join(root, 'proj', 'R', 'a.R')
    );
    expect(await resolveAllowedPath(root + '/', [root])).toBe(root);
  });

  it('normalises dot segments that stay inside', async () => {
    expect(await resolveAllowedPath(path.join(root, 'proj', '..', 'proj', 'R'), [root])).toBe(
      path.join(root, 'proj', 'R')
    );
  });

  it('allows symlinks that stay inside and resolves them', async () => {
    expect(await resolveAllowedPath(path.join(root, 'inside-link'), [root])).toBe(
      path.join(root, 'proj')
    );
  });

  it('accepts a root given through a symlink alias', async () => {
    const alias = path.join(base, 'root-alias');
    expect(await resolveAllowedPath(path.join(root, 'proj'), [alias])).toBe(
      path.join(root, 'proj')
    );
    expect(await resolveAllowedPath(path.join(alias, 'proj'), [root])).toBe(
      path.join(root, 'proj')
    );
  });

  it('rejects paths outside every root', async () => {
    expect(await resolveAllowedPath(outside, [root])).toBeNull();
    expect(await resolveAllowedPath('/etc', [root])).toBeNull();
    expect(await resolveAllowedPath('/etc/passwd', [root])).toBeNull();
    expect(await resolveAllowedPath('/', [root])).toBeNull();
  });

  it('rejects a sibling that merely shares the root as string prefix', async () => {
    expect(await resolveAllowedPath(path.join(base, 'projects-evil'), [root])).toBeNull();
  });

  it('rejects traversal out of the root', async () => {
    expect(await resolveAllowedPath(path.join(root, '..', 'secret'), [root])).toBeNull();
    expect(await resolveAllowedPath(root + '/../../etc', [root])).toBeNull();
    expect(await resolveAllowedPath(root + '/proj/../../secret/passwd.R', [root])).toBeNull();
  });

  it('rejects symlink escapes (directory and file)', async () => {
    expect(await resolveAllowedPath(path.join(root, 'escape-dir'), [root])).toBeNull();
    expect(await resolveAllowedPath(path.join(root, 'escape-dir', 'passwd.R'), [root])).toBeNull();
    expect(await resolveAllowedPath(path.join(root, 'escape-file.R'), [root])).toBeNull();
  });

  it('rejects non-existent paths, even inside the root', async () => {
    expect(await resolveAllowedPath(path.join(root, 'missing'), [root])).toBeNull();
    expect(await resolveAllowedPath('/nonexistent', [root])).toBeNull();
  });

  it('rejects relative paths and malformed input', async () => {
    expect(await resolveAllowedPath('proj', [root])).toBeNull();
    expect(await resolveAllowedPath('./proj', [root])).toBeNull();
    expect(await resolveAllowedPath('../projects/proj', [root])).toBeNull();
    expect(await resolveAllowedPath('', [root])).toBeNull();
    expect(await resolveAllowedPath(undefined, [root])).toBeNull();
    expect(await resolveAllowedPath(42, [root])).toBeNull();
    expect(await resolveAllowedPath({ a: 1 }, [root])).toBeNull();
    expect(await resolveAllowedPath(root + '\0/proj', [root])).toBeNull();
    expect(await resolveAllowedPath('/' + 'a'.repeat(5000), [root])).toBeNull();
  });

  it('allows nothing when the root does not exist or no roots are configured', async () => {
    expect(await resolveAllowedPath(root, [path.join(base, 'no-such-root')])).toBeNull();
    expect(await resolveAllowedPath(root, [])).toBeNull();
  });

  it('supports several roots', async () => {
    expect(await resolveAllowedPath(outside, [root, outside])).toBe(outside);
    expect(await resolveAllowedPath(path.join(root, 'proj'), [outside, root])).toBe(
      path.join(root, 'proj')
    );
  });
});

describe('path confinement over HTTP', () => {
  let restricted: TestServer;
  let open: TestServer;
  const NOT_ALLOWED = { error: true, code: 'PATH_NOT_ALLOWED', message: PATH_NOT_ALLOWED_MESSAGE };

  beforeAll(async () => {
    restricted = await startTestServer({ ALLOWED_PROJECT_ROOTS: root });
    open = await startTestServer({});
  });
  afterAll(async () => {
    await restricted.stop();
    await open.stop();
  });

  const routes = [
    '/api/detect-workflow',
    '/api/v1/detect-workflow',
    '/api/validate-project',
    '/api/v1/validate-project',
    '/api/validate-file',
    '/api/v1/validate-file',
  ];

  it('answers identically for out-of-root, missing, traversal, symlink-escape and relative paths', async () => {
    const inputs = [
      '/etc',
      '/etc/passwd',
      '/nonexistent',
      '/nonexistent.R',
      path.join(root, '..', 'secret'),
      root + '/../../etc',
      path.join(root, 'escape-dir'),
      path.join(root, 'escape-file.R'),
      path.join(root, 'missing'),
      'proj',
      '../etc',
    ];
    for (const route of routes) {
      for (const input of inputs) {
        const r = await postJson(restricted.base, route, { path: input });
        expect({ route, input, status: r.status, body: r.body }).toEqual({
          route,
          input,
          status: 400,
          body: NOT_ALLOWED,
        });
        expect(JSON.stringify(r.body)).not.toContain(JSON.stringify(input).slice(1, -1));
      }
    }
  });

  it('serves paths inside the root on v0 and v1', async () => {
    for (const v of ['/api', '/api/v1']) {
      const detect = await postJson(restricted.base, `${v}/detect-workflow`, {
        path: path.join(root, 'proj'),
      });
      expect(detect.status).toBe(200);
      const project = await postJson(restricted.base, `${v}/validate-project`, {
        path: path.join(root, 'proj'),
        workflow: 'package',
      });
      expect(project.status).toBe(200);
      const file = await postJson(restricted.base, `${v}/validate-file`, {
        path: path.join(root, 'proj', 'R', 'a.R'),
      });
      expect(file.status).toBe(200);
    }
  });

  it('keeps validation errors for malformed input (no filesystem access)', async () => {
    const missing = await postJson(restricted.base, '/api/validate-project', {});
    expect(missing.body.code).toBe('MISSING_PARAMETER');
    const nul = await postJson(restricted.base, '/api/validate-project', { path: '/a\0b' });
    expect(nul.body.code).toBe('INVALID_PATH');
  });

  it('keeps the old 404 behaviour in unrestricted mode', async () => {
    const project = await postJson(open.base, '/api/validate-project', { path: '/nonexistent' });
    expect(project.status).toBe(404);
    expect(project.body.code).toBe('PATH_NOT_FOUND');
    const file = await postJson(open.base, '/api/v1/validate-file', { path: '/nonexistent.R' });
    expect(file.status).toBe(404);
    expect(file.body.code).toBe('FILE_NOT_FOUND');
    const etc = await postJson(open.base, '/api/validate-project', { path: '/etc' });
    expect(etc.status).toBe(200);
  });
});
