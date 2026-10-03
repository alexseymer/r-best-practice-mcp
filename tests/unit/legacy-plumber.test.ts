import { createTempDir, cleanupTempDir, createFile } from '../fixtures/setup';
import { idsFor } from '../fixtures/rules';

const ENDPOINT = "#* @get /hello\nfunction() {\n  list(msg = 'hi')\n}\n";

describe('plumber-validation / plumber-error (original rules)', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  it('does not treat substrings such as "checkpoint" or "specific(" as validation', async () => {
    createFile(dir, 'api.R', `${ENDPOINT}checkpoint <- 1\nspecific(x)\n`);
    expect(await idsFor(dir, 'plumber')).toContain('plumber-validation');
  });

  it.each([
    'validate_input(x)',
    'checkmate::check_number(x)',
    'stopifnot(is.numeric(x))',
    'req(x)',
    'if (x > 1) 1',
  ])('accepts %s as validation', async (call) => {
    createFile(dir, 'api.R', `${ENDPOINT}${call}\n`);
    expect(await idsFor(dir, 'plumber')).not.toContain('plumber-validation');
  });

  it('ignores validation and error handling that only appears in a string', async () => {
    createFile(dir, 'api.R', `${ENDPOINT}msg <- "if (x) stop(y) validate(z) tryCatch(w)"\n`);
    const ids = await idsFor(dir, 'plumber');
    expect(ids).toContain('plumber-validation');
    expect(ids).toContain('plumber-error');
  });

  it('finds plumber files in subdirectories and with a lowercase .r extension', async () => {
    createFile(dir, 'R/endpoints.r', ENDPOINT);
    const ids = await idsFor(dir, 'plumber');
    expect(ids).toContain('plumber-validation');
    expect(ids).toContain('plumber-error');
  });

  it('is satisfied by a well-formed endpoint file in a subdirectory', async () => {
    createFile(
      dir,
      'R/api.R',
      '#* @get /hello\nfunction(n) {\n  tryCatch({\n    stopifnot(is.numeric(n))\n    list(n = n)\n  }, error = function(e) stop(e))\n}\n'
    );
    const ids = await idsFor(dir, 'plumber');
    expect(ids).not.toContain('plumber-validation');
    expect(ids).not.toContain('plumber-error');
  });
});
