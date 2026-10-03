import { createTempDir, cleanupTempDir, createFile } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';
import { Finding } from '../../../src/types/finding';
import { Workflow } from '../../../src/types/workflow';

/** Regression tests for defects found in review of the rule set. */

const N = 100_000;
const GENEROUS_MS = 2000;
const FM = '---\ntitle: "T"\nformat: html\n---\n\n';
const crlf = (s: string): string => s.replace(/\n/g, '\r\n');
const filler = (n: number): string =>
  Array.from({ length: n }, (_, i) => `x${i} <- ${i}`).join('\n');

describe('rule regressions', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  const find = async (id: string, wf: Workflow): Promise<Finding | undefined> =>
    (await findingsFor(dir, wf)).find((f) => f.id === id);

  /** Runs the validator and asserts that it returns within the generous time limit. */
  const timed = async (wf: Workflow): Promise<Finding[]> => {
    const start = Date.now();
    const findings = await findingsFor(dir, wf);
    expect(Date.now() - start).toBeLessThan(GENEROUS_MS);
    return findings;
  };

  describe('targets-naming: multi-line tar_target() calls', () => {
    it('checks a name on its own line and reports the line of the call', async () => {
      createFile(
        dir,
        '_targets.R',
        'library(targets)\nlist(\n  tar_target(\n    rawData,\n    1\n  ),\n  tar_target(ok_name, 2)\n)\n'
      );
      const f = await find('targets-naming', 'targets');
      expect(f?.details).toBe('Non-snake_case targets: rawData');
      expect(f?.line).toBe(3);
      expect(f?.severity).toBe('recommended');
      expect(f?.category).toBe('naming');
    });

    it('checks name = on a following line, with CRLF', async () => {
      createFile(
        dir,
        '_targets.R',
        crlf('list(\n  tar_target(\n    name = CleanData,\n    command = 1\n  )\n)\n')
      );
      const f = await find('targets-naming', 'targets');
      expect(f?.details).toContain('CleanData');
      expect(f?.line).toBe(2);
    });

    it('accepts multi-line calls with snake_case names', async () => {
      createFile(dir, '_targets.R', 'list(\n  tar_target(\n    raw_data,\n    1\n  )\n)\n');
      expect(await idsFor(dir, 'targets')).not.toContain('targets-naming');
    });

    it.each([
      ['a trailing comment', 'list(tar_target(good_name, 1)) # tar_target(\n  BadName, 2)\n'],
      ['a multi-line string', 'doc <- "see\\ntar_target(BadName, 1)"\nlist(tar_target(good, 1))\n'],
      ['an apostrophe in a comment', "# don't\nlist(tar_target(good_name, 1))\n"],
    ])('ignores a call inside %s', async (_label, text) => {
      createFile(dir, '_targets.R', text);
      expect(await idsFor(dir, 'targets')).not.toContain('targets-naming');
    });

    it('is linear on adversarial input', async () => {
      createFile(dir, '_targets.R', 'tar_target('.repeat(N / 11) + ' '.repeat(N));
      await timed('targets');
    });
  });

  describe('plumber: quadratic route handling', () => {
    it.each(['<', '{', '<<', '{{', '<>', '{}'])(
      'returns quickly for a route made of %s repeated',
      async (piece) => {
        createFile(dir, 'api.R', `#* @get /${piece.repeat(N)}\nfunction() 1\n`);
        await timed('plumber');
      }
    );

    it('still ignores balanced dynamic segments in paths', async () => {
      createFile(dir, 'api.R', '#* Item\n#* @get /items/<id:int>/{slug}\nfunction(id) 1\n');
      expect(await idsFor(dir, 'plumber')).not.toContain('plumber-paths');
    });

    it('still flags uppercase after an unclosed bracket', async () => {
      createFile(dir, 'api.R', '#* Item\n#* @get /items/<Id\nfunction(id) 1\n');
      expect(await idsFor(dir, 'plumber')).toContain('plumber-paths');
    });
  });

  describe("plumber: #' annotations and @options", () => {
    it("reports an undocumented #' endpoint", async () => {
      createFile(dir, 'api.R', "#' @get /ping\nfunction() 1\n");
      const f = await find('plumber-docs', 'plumber');
      expect(f?.line).toBe(1);
      expect(f?.category).toBe('documentation');
    });

    it("is satisfied by a #' description line", async () => {
      createFile(dir, 'api.R', "#' Ping the server\n#' @get /ping\nfunction() 1\n");
      expect(await idsFor(dir, 'plumber')).not.toContain('plumber-docs');
    });

    it("accepts mixed #* and #' lines in one block", async () => {
      createFile(dir, 'api.R', "#* Ping the server\n#' @get /ping\nfunction() 1\n");
      expect(await idsFor(dir, 'plumber')).not.toContain('plumber-docs');
    });

    it("flags a bad path in a #' endpoint", async () => {
      createFile(dir, 'api.R', "#' Users\n#' @get /getUsers\nfunction() 1\n");
      const f = await find('plumber-paths', 'plumber');
      expect(f?.details).toContain('/getUsers');
    });

    it("reports missing status codes for a #' api, and accepts res$status", async () => {
      createFile(dir, 'api.R', "#' Ping\n#' @get /ping\nfunction() 1\n");
      expect(await idsFor(dir, 'plumber')).toContain('plumber-status');
      createFile(dir, 'api.R', "#' Ping\n#' @get /ping\nfunction(res) { res$status <- 404; 1 }\n");
      expect(await idsFor(dir, 'plumber')).not.toContain('plumber-status');
    });

    it('recognises @options endpoints', async () => {
      createFile(dir, 'api.R', '#* @options /Bad_Path\nfunction() 1\n');
      const ids = await idsFor(dir, 'plumber');
      expect(ids).toContain('plumber-docs');
      expect(ids).toContain('plumber-paths');
    });

    it('ignores a roxygen block of an ordinary function file', async () => {
      createFile(
        dir,
        'R/helper.R',
        "#' Add numbers\n#'\n#' @param a A number\n#' @param b A number\n#' @return The sum\n#' @export\nadd <- function(a, b) a + b\n"
      );
      const ids = await idsFor(dir, 'plumber');
      expect(ids).not.toContain('plumber-docs');
      expect(ids).not.toContain('plumber-paths');
      expect(ids).not.toContain('plumber-status');
    });
  });

  describe('shiny: stripComments is linear', () => {
    it.each(['"', "'"])(
      'returns quickly for 50k repetitions of " #" followed by %s',
      async (quote) => {
        createFile(dir, 'app.R', `x <- input$a${' #'.repeat(N / 2)}${quote}\n`);
        await timed('shiny');
      }
    );

    it('ignores keywords in trailing comments but keeps those in code', async () => {
      createFile(dir, 'app.R', 'x <- input$a # req(input$a)\n');
      expect(await idsFor(dir, 'shiny')).toContain('shiny-validation');
      createFile(dir, 'app.R', 'x <- req(input$a) # check\n');
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-validation');
    });

    it('does not treat # inside a string as a comment', async () => {
      createFile(dir, 'app.R', 'x <- paste("#", input$a); y <- req(input$a)\n');
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-validation');
    });
  });

  describe('r-script: other quadratic patterns', () => {
    it.each([
      ['dashes', '#' + '-'.repeat(N) + 'x'],
      ['hashes', '#' + '#'.repeat(N / 2) + ' x'],
      ['equals', '#' + '='.repeat(N) + 'x'],
    ])('section marker detection is linear (%s)', async (_label, line) => {
      createFile(dir, 'long_script.R', `${filler(90)}\n${line}\n`);
      await timed('r-script');
    });
  });

  describe('quarto-options: knitr-style options', () => {
    const f = (): Promise<Finding | undefined> => find('quarto-options', 'quarto');

    it('reports chunks without any option', async () => {
      createFile(dir, 'a.qmd', `${FM}\`\`\`{r}\nx <- 1\n\`\`\`\n`);
      expect((await f())?.message).toContain('Consider setting chunk options');
    });

    it.each(['{r, echo=FALSE}', '{r setup, include=FALSE}', '{r fig.width=5}', '{r a, eval = F}'])(
      'is satisfied by header options %s',
      async (header) => {
        createFile(dir, 'a.qmd', `${FM}\`\`\`${header}\nx <- 1\n\`\`\`\n`);
        expect(await f()).toBeUndefined();
      }
    );

    it('is satisfied by knitr::opts_chunk$set() in a chunk', async () => {
      createFile(
        dir,
        'a.qmd',
        `${FM}\`\`\`{r}\nknitr::opts_chunk$set(echo = FALSE)\n\`\`\`\n\n\`\`\`{r}\nx <- 1\n\`\`\`\n`
      );
      expect(await f()).toBeUndefined();
    });

    it('is not satisfied by a label or an opts_chunk$set mention in a comment/string', async () => {
      createFile(
        dir,
        'a.qmd',
        `${FM}\`\`\`{r label}\n# knitr::opts_chunk$set(echo = FALSE)\nx <- "opts_chunk$set(a)"\n\`\`\`\n`
      );
      expect(await f()).toBeDefined();
    });
  });

  describe('quarto figures/tables: hidden via header options', () => {
    it.each(['{r eval=FALSE}', '{r, eval=F}', '{r plot, include=FALSE}', '{r include = F}'])(
      'skips plot and table chunks with %s',
      async (header) => {
        createFile(dir, 'a.qmd', `${FM}\`\`\`${header}\nplot(1)\nknitr::kable(head(x))\n\`\`\`\n`);
        const ids = await idsFor(dir, 'quarto');
        expect(ids).not.toContain('quarto-figures');
        expect(ids).not.toContain('quarto-tables');
      }
    );

    it.each(['{r}', '{r, eval=TRUE}', '{r, echo=FALSE}', '{r evaluate=FALSE}'])(
      'still checks chunks with %s',
      async (header) => {
        createFile(dir, 'a.qmd', `${FM}\`\`\`${header}\nplot(1)\nknitr::kable(head(x))\n\`\`\`\n`);
        const ids = await idsFor(dir, 'quarto');
        expect(ids).toContain('quarto-figures');
        expect(ids).toContain('quarto-tables');
      }
    );
  });

  describe('blogdown-metadata: nested docs/ sections', () => {
    it('reports content/docs/post.md without front matter', async () => {
      createFile(dir, 'content/docs/post.md', '# No front matter\n');
      const f = await find('blogdown-metadata', 'blogdown');
      expect(f?.details).toContain('docs');
      expect(f?.details).toContain('post.md');
    });

    it('does not read the build output public/ at the project root', async () => {
      createFile(dir, 'public/post.md', '# Generated\n');
      createFile(dir, 'content/post/a.md', '---\ntitle: a\n---\n');
      expect(await idsFor(dir, 'blogdown')).not.toContain('blogdown-metadata');
    });

    it('does not read node_modules inside content', async () => {
      createFile(dir, 'content/node_modules/x/readme.md', '# readme\n');
      expect(await idsFor(dir, 'blogdown')).not.toContain('blogdown-metadata');
    });

    it('tolerates leading blank lines and a BOM before the front matter', async () => {
      createFile(dir, 'content/a.md', '\n\n---\ntitle: a\n---\n');
      createFile(dir, 'content/b.md', '﻿\n  \n+++\ntitle = "b"\n+++\n');
      createFile(dir, 'content/c.md', '\n{"title": "c"}\n');
      expect(await idsFor(dir, 'blogdown')).not.toContain('blogdown-metadata');
    });
  });

  describe('blogdown-deployment: more CI systems and publishDir', () => {
    it.each([
      ['.travis.yml', 'language: r\n'],
      ['.circleci/config.yml', 'version: 2.1\n'],
      ['azure-pipelines.yml', 'trigger: none\n'],
      ['config.toml', 'baseURL = "/"\npublishDir = "docs"\n'],
      ['config.yaml', 'baseURL: /\npublishDir: docs\n'],
      ['hugo.toml', 'PublishDir = "out"\n'],
      ['config/_default/config.toml', 'publishDir = "out"\n'],
    ])('is satisfied by %s', async (file, content) => {
      createFile(dir, file, content);
      expect(await idsFor(dir, 'blogdown')).not.toContain('blogdown-deployment');
    });

    it('is not satisfied by a config without publishDir or a commented publishDir', async () => {
      createFile(dir, 'config.toml', 'baseURL = "/"\n# publishDir = "docs"\n');
      expect(await idsFor(dir, 'blogdown')).toContain('blogdown-deployment');
    });
  });

  describe('rscript-cleanup: dotted variable names, comments and strings', () => {
    const body = (text: string): string => `# header\n${text}\n`;

    it.each(['my.con', '.con', '.my_con2'])('detects %s <- file(...)', async (name) => {
      createFile(dir, 'job_script.R', body(`${name} <- file("x", "r")\nreadLines(${name})`));
      const f = await find('rscript-cleanup', 'r-script');
      expect(f?.message).toContain('file()');
      expect(f?.line).toBe(2);
    });

    it('detects a dotted url() connection', async () => {
      createFile(dir, 'job_script.R', body('my.url <- url("https://example.com")'));
      expect((await find('rscript-cleanup', 'r-script'))?.message).toContain('url()');
    });

    it('still skips file("stdin")', async () => {
      createFile(dir, 'job_script.R', body('in.con <- file("stdin")'));
      expect(await find('rscript-cleanup', 'r-script')).toBeUndefined();
    });

    it('ignores openers in trailing comments and strings', async () => {
      createFile(
        dir,
        'job_script.R',
        body('x <- 1 # pdf("a.pdf")\nmsg <- "call png(\\"a.png\\") first"\ny <- 2')
      );
      expect(await find('rscript-cleanup', 'r-script')).toBeUndefined();
    });

    it('ignores releases in trailing comments and strings', async () => {
      createFile(
        dir,
        'job_script.R',
        body('pdf("a.pdf")\nplot(1) # dev.off()\nmsg <- "dev.off()"')
      );
      expect((await find('rscript-cleanup', 'r-script'))?.message).toContain('pdf()');
    });

    it('accepts a release after a code line with a comment', async () => {
      createFile(dir, 'job_script.R', body('pdf("a.pdf") # open\nplot(1)\ndev.off() # close'));
      expect(await find('rscript-cleanup', 'r-script')).toBeUndefined();
    });
  });

  describe('r-script: listScripts', () => {
    it('lists lowercase .r files', async () => {
      createFile(dir, 'MyScript.r', '# x\n');
      const f = await find('rscript-naming', 'r-script');
      expect(f?.details).toContain('MyScript.r');
    });

    it('accepts a snake_case .r file', async () => {
      createFile(dir, 'my_script.r', '# x\n');
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-naming');
    });

    it('still checks scripts in the root when a deep tree holds hundreds of files', async () => {
      for (let i = 0; i < 210; i++) createFile(dir, `a/b/c/f${i}.R`, '# x\n');
      createFile(dir, 'BadName.R', '# x\n');
      createFile(dir, 'zzz/BadSub.R', '# x\n');
      const f = await find('rscript-naming', 'r-script');
      expect(f?.details).toContain('BadName.R');
      expect(f?.details).toContain(`zzz`);
    });

    it('does not report deeper scripts (depth limit)', async () => {
      createFile(dir, 'a/b/BadDeep.R', '# x\n');
      expect(await idsFor(dir, 'r-script')).not.toContain('rscript-naming');
    });
  });

  describe('shinytest-ci-integration: Travis', () => {
    it('is not satisfied by a .travis.yml that does not run tests', async () => {
      createFile(dir, '.travis.yml', 'language: r\nscript:\n  - Rscript -e "lintr::lint_dir()"\n');
      expect(await idsFor(dir, 'shinytest')).toContain('shinytest-ci-integration');
    });
  });

  describe('BOM handling', () => {
    it("pkg-roxygen accepts a #' line right after a BOM", async () => {
      createFile(dir, 'DESCRIPTION', 'Package: p\nVersion: 0.1.0\n');
      createFile(dir, 'R/a.R', "﻿#' Title\n#' @export\nf <- function() 1\n");
      expect(await idsFor(dir, 'package')).not.toContain('pkg-roxygen');
    });

    it('pkg-roxygen still reports files without roxygen after a BOM', async () => {
      createFile(dir, 'R/a.R', '﻿# plain\nf <- function() 1\n');
      expect(await idsFor(dir, 'package')).toContain('pkg-roxygen');
    });

    it('quarto and rmarkdown front matter is read after a BOM', async () => {
      createFile(dir, 'a.qmd', `﻿---\nexecute:\n  echo: false\n---\n\n\`\`\`{r}\nx <- 1\n\`\`\`\n`);
      expect(await idsFor(dir, 'quarto')).not.toContain('quarto-options');
      createFile(dir, 'index.Rmd', '﻿---\ntitle: T\n---\n\n```{r}\nx <- 1\n```\n');
      expect(await idsFor(dir, 'bookdown')).not.toContain('bookdown-output-formats-crash');
    });
  });
});
