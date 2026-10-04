import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';

describe('plumber rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('plumber-docs', () => {
    it('reports an undocumented endpoint with file and line', async () => {
      createFile(
        dir,
        'plumber.R',
        `#* Documented
#* @get /ok
function() 1

#* @param a A number
#* @get /sum
function(a) a
`
      );
      const found = (await findingsFor(dir, 'plumber')).filter((f) => f.id === 'plumber-docs');
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('recommended');
      expect(found[0].category).toBe('documentation');
      expect(found[0].message.length).toBeGreaterThan(0);
      expect(found[0].suggestions?.length).toBeGreaterThan(0);
      expect(found[0].file).toBe(`${dir}/plumber.R`);
      expect(found[0].line).toBe(6);
    });

    it('is satisfied by a description line, in any position of the block', async () => {
      createFile(
        dir,
        'plumber.R',
        '#* @get /a\r\n#* Returns a value\r\nfunction() 1\r\n\r\n#* Sum\r\n#* @post /b\r\nfunction() 2\r\n'
      );
      expect(await idsFor(dir, 'plumber')).not.toContain('plumber-docs');
    });

    it('does not count a description separated by a blank line', async () => {
      createFile(
        dir,
        'plumber.R',
        '#* Some filter docs\nfunction() 1\n\n#* @get /a\nfunction() 1\n'
      );
      expect(await idsFor(dir, 'plumber')).toContain('plumber-docs');
    });

    it('ignores R files without endpoint annotations', async () => {
      createFile(dir, 'helpers.R', '#* @filter log\nf <- function() 1\n');
      expect(await idsFor(dir, 'plumber')).not.toContain('plumber-docs');
    });

    it('ignores empty files', async () => {
      createFile(dir, 'plumber.R', '');
      expect(await idsFor(dir, 'plumber')).not.toContain('plumber-docs');
    });
  });

  describe('plumber-paths', () => {
    it.each([
      '/getUsers',
      '/Users',
      '/user_list',
      '/create-user',
      '/delete_item',
      '/set-value/<id>',
    ])('reports %s', async (route) => {
      createFile(dir, 'plumber.R', `#* Doc\n#* @get ${route}\nfunction() 1\n`);
      const found = (await findingsFor(dir, 'plumber')).filter((f) => f.id === 'plumber-paths');
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('recommended');
      expect(found[0].category).toBe('structure');
      expect(found[0].message.length).toBeGreaterThan(0);
      expect(found[0].suggestions?.length).toBeGreaterThan(0);
      expect(found[0].details).toContain(route);
      expect(found[0].line).toBe(2);
    });

    it.each([
      '/users',
      '/users/<id>',
      '/users/<user_id:int>/orders',
      '/settings',
      '/address',
      '/updates',
      '/health-check',
      '/',
    ])('accepts %s', async (route) => {
      createFile(dir, 'plumber.R', `#* Doc\n#* @post ${route}\nfunction() 1\n`);
      expect(await idsFor(dir, 'plumber')).not.toContain('plumber-paths');
    });

    it('lists at most 5 distinct paths', async () => {
      const body = Array.from(
        { length: 8 },
        (_, i) => `#* Doc\n#* @get /get_item${i}\nf <- 1\n`
      ).join('\n');
      createFile(dir, 'plumber.R', body);
      const found = (await findingsFor(dir, 'plumber')).filter((f) => f.id === 'plumber-paths');
      expect(found).toHaveLength(1);
      expect(found[0].details).toContain('/get_item4');
      expect(found[0].details).not.toContain('/get_item5');
    });
  });

  describe('plumber-status', () => {
    const endpoint = '#* Doc\n#* @get /users/<id>\nfunction(id) list(id = id)\n';

    it('reports endpoints without any res$status', async () => {
      createFile(dir, 'plumber.R', endpoint);
      const found = (await findingsFor(dir, 'plumber')).filter((f) => f.id === 'plumber-status');
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('recommended');
      expect(found[0].category).toBe('structure');
      expect(found[0].message.length).toBeGreaterThan(0);
      expect(found[0].suggestions?.length).toBeGreaterThan(0);
      expect(found[0].file).toBe(`${dir}/plumber.R`);
    });

    it('is satisfied by res$status in the same or another file', async () => {
      createFile(dir, 'plumber.R', endpoint);
      createFile(dir, 'R/errors.R', 'fail <- function(res) { res$status <- 400 }\n');
      expect(await idsFor(dir, 'plumber')).not.toContain('plumber-status');
    });

    it('is not satisfied by res$status in a comment', async () => {
      createFile(dir, 'plumber.R', `${endpoint}# TODO set res$status <- 404\n`);
      expect(await idsFor(dir, 'plumber')).toContain('plumber-status');
    });

    it('does not fire when there are no endpoints', async () => {
      createFile(dir, 'helpers.R', 'f <- function() 1\n');
      expect(await idsFor(dir, 'plumber')).not.toContain('plumber-status');
    });
  });

  it('does not run plumber rules for other workflows', async () => {
    createFile(dir, 'plumber.R', '#* @get /getUsers\nfunction() 1\n');
    const ids = await idsFor(dir, 'r-script');
    expect(ids).not.toContain('plumber-docs');
    expect(ids).not.toContain('plumber-paths');
  });
});
