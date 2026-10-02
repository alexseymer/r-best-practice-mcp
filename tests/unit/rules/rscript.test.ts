import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';
import { Finding } from '../../../src/types/finding';

const code = (n: number): string =>
  Array.from({ length: n }, (_, i) => `x${i} <- ${i}`).join('\n') + '\n';
const crlf = (s: string): string => s.replace(/\n/g, '\r\n');

describe('r-script rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  const find = async (id: string): Promise<Finding | undefined> =>
    (await findingsFor(dir, 'r-script')).find((f) => f.id === id);

  describe('rscript-naming', () => {
    it.each(['MyScript.R', 'my-script.R', 'Analysis 1.R'])('reports %s', async (name) => {
      createFile(dir, name, '# x\n');
      const finding = await find('rscript-naming');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('recommended');
      expect(finding!.category).toBe('naming');
      expect(finding!.message.length).toBeGreaterThan(0);
      expect(finding!.suggestions!.length).toBeGreaterThan(0);
      expect(finding!.details).toContain(name);
    });

    it('checks one level of subdirectories', async () => {
      createFile(dir, 'scripts/BadName.R', '# x\n');
      expect(await idsFor(dir, 'r-script')).toContain('rscript-naming');
    });

    it('does not look deeper than one subdirectory', async () => {
      createFile(dir, 'a/b/BadName.R', '# x\n');
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-naming');
    });

    it('accepts snake_case names', async () => {
      createFile(dir, 'data_cleaning.R', '# x\n');
      createFile(dir, '01_import.R', '# x\n');
      createFile(dir, 'scripts/fit_model2.R', '# x\n');
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-naming');
    });

    it('ignores files in renv and non-R files', async () => {
      createFile(dir, 'renv/Activate.R', '# x\n');
      createFile(dir, 'Notes File.txt', 'x\n');
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-naming');
    });
  });

  describe('rscript-sections', () => {
    it('reports a long script without sections', async () => {
      createFile(dir, 'long_script.R', code(81));
      const finding = await find('rscript-sections');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('recommended');
      expect(finding!.category).toBe('structure');
      expect(finding!.message).toMatch(/^Consider/);
      expect(finding!.suggestions!.length).toBeGreaterThan(0);
      expect(finding!.file).toContain('long_script.R');
    });

    it.each([
      ['rstudio section', '# Load data ----'],
      ['dashes', '# ---------------'],
      ['hashes', '#### Load ####'],
      ['equals', '# ===== Load ====='],
    ])('accepts %s markers', async (_label, marker) => {
      createFile(dir, 'long_script.R', `${marker}\n${code(85)}`);
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-sections');
    });

    it.each([
      ['exactly 80 lines', code(80)],
      ['short script', code(10)],
      ['empty file', ''],
    ])('does not flag %s', async (_label, content) => {
      createFile(dir, 'a_script.R', content);
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-sections');
    });

    it('handles CRLF line endings', async () => {
      createFile(dir, 'a_script.R', crlf(`# Load ----\n${code(85)}`));
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-sections');
    });
  });

  describe('rscript-errors', () => {
    it('reports a long script without error handling', async () => {
      createFile(dir, 'long_script.R', code(61));
      const finding = await find('rscript-errors');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('recommended');
      expect(finding!.category).toBe('structure');
      expect(finding!.message).toMatch(/^Consider/);
      expect(finding!.suggestions!.length).toBeGreaterThan(0);
    });

    it.each([
      'tryCatch(f(), error = identity)',
      'try(f())',
      'stopifnot(TRUE)',
      'stop("x")',
      'withCallingHandlers(f())',
    ])('is satisfied by %s', async (call) => {
      createFile(dir, 'long_script.R', `${code(70)}${call}\n`);
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-errors');
    });

    it.each([
      ['exactly 60 lines', code(60)],
      ['empty file', ''],
    ])('does not flag %s', async (_label, content) => {
      createFile(dir, 'a_script.R', content);
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-errors');
    });

    it('handles CRLF line endings', async () => {
      createFile(dir, 'a_script.R', crlf(`${code(70)}tryCatch(f(), error = identity)\n`));
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-errors');
    });

    it('does not count a mention in a comment as handling', async () => {
      createFile(dir, 'a_script.R', `# use tryCatch( here later\n${code(70)}`);
      expect(await idsFor(dir, 'r-script')).toContain('rscript-errors');
    });

    it('does not mistake similarly named functions for handlers', async () => {
      createFile(dir, 'a_script.R', `${code(70)}retry(f())\nmy.stop(1)\n`);
      expect(await idsFor(dir, 'r-script')).toContain('rscript-errors');
    });
  });

  describe('rscript-cleanup', () => {
    it.each([
      [
        'dbConnect',
        'con <- DBI::dbConnect(RSQLite::SQLite(), "a.sqlite")\nDBI::dbGetQuery(con, "x")',
      ],
      ['file', 'con <- file("out.txt", "w")\nwriteLines("a", con)'],
      ['url', 'con <- url("https://example.com/x.csv")\nreadLines(con)'],
      ['sink', 'sink("log.txt")\nprint(1)'],
      ['png', 'png("plot.png")\nplot(1)'],
      ['pdf', 'pdf("plot.pdf")\nplot(1)'],
      ['jpeg', 'jpeg("plot.jpg")\nplot(1)'],
      ['svg', 'svg("plot.svg")\nplot(1)'],
    ])('reports an unmatched %s()', async (opener, body) => {
      createFile(dir, 'job_script.R', `# header\n${body}\n`);
      const finding = await find('rscript-cleanup');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('recommended');
      expect(finding!.category).toBe('structure');
      expect(finding!.message).toMatch(/^Consider/);
      expect(finding!.message).toContain(`${opener}()`);
      expect(finding!.suggestions!.length).toBeGreaterThan(0);
      expect(finding!.file).toContain('job_script.R');
      expect(finding!.line).toBe(2);
    });

    it.each([
      ['dbDisconnect', 'con <- DBI::dbConnect(RSQLite::SQLite(), "a")\nDBI::dbDisconnect(con)'],
      ['close', 'con <- file("out.txt", "w")\nwriteLines("a", con)\nclose(con)'],
      ['sink()', 'sink("log.txt")\nprint(1)\nsink()'],
      ['sink(NULL)', 'sink("log.txt")\nprint(1)\nsink(NULL)'],
      ['dev.off', 'png("plot.png")\nplot(1)\ndev.off()'],
      [
        'on.exit',
        'f <- function() {\n  con <- DBI::dbConnect(x)\n  on.exit(DBI::dbDisconnect(con))\n}',
      ],
    ])('is satisfied by %s', async (_label, body) => {
      createFile(dir, 'job_script.R', `${body}\n`);
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-cleanup');
    });

    it.each([
      ['commented opener', '# con <- DBI::dbConnect(x)\n# png("a.png")\nx <- 1'],
      ['inline connection', 'lines <- readLines(file("in.txt"))'],
      ['stdin', 'con <- file("stdin")\nx <- readLines(con, n = 1)'],
      ['similar names', 'p <- file.path("a", "b")\nq <- profile(1)\nr <- tempfile()\nrepng(1)'],
      ['empty file', ''],
    ])('does not flag %s', async (_label, body) => {
      createFile(dir, 'job_script.R', `${body}\n`);
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-cleanup');
    });

    it('handles CRLF line endings', async () => {
      createFile(dir, 'job_script.R', crlf('png("a.png")\nplot(1)\ndev.off()\n'));
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-cleanup');
    });

    it('ignores a closing call that only appears in a comment', async () => {
      createFile(dir, 'job_script.R', 'png("a.png")\nplot(1)\n# dev.off()\n');
      expect(await idsFor(dir, 'r-script')).toContain('rscript-cleanup');
    });
  });
});
