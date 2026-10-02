import { createTempDir, cleanupTempDir, createFile, createDir } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';

const lines = (n: number, line = 'x <- 1'): string => Array(n).fill(line).join('\n') + '\n';

describe('shiny rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('shiny-validation', () => {
    const noValidation = `library(shiny)
ui <- fluidPage(numericInput("n", "N", 10), plotOutput("p"))
server <- function(input, output, session) {
  output$p <- renderPlot(hist(rnorm(input$n)))
}
shinyApp(ui, server)
`;

    it('reports an app that reads input without validation', async () => {
      createFile(dir, 'app.R', noValidation);
      const found = (await findingsFor(dir, 'shiny')).filter((f) => f.id === 'shiny-validation');
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('recommended');
      expect(found[0].category).toBe('structure');
      expect(found[0].message.length).toBeGreaterThan(0);
      expect(found[0].suggestions?.length).toBeGreaterThan(0);
    });

    it('finds input usage in R/ files too', async () => {
      createFile(dir, 'app.R', 'library(shiny)\n');
      createFile(dir, 'R/server.R', 'f <- function(input) input$x\n');
      expect(await idsFor(dir, 'shiny')).toContain('shiny-validation');
    });

    it.each([
      'req(input$n)',
      'validate(need(input$n > 0, "positive"))',
      'InputValidator$new()',
      'validate_inputs(input$n)',
      'shinyFeedback::feedback("n", TRUE)',
    ])('is satisfied by %s', async (snippet) => {
      createFile(dir, 'app.R', `${noValidation}\n${snippet}\n`);
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-validation');
    });

    it('is not satisfied by a keyword only in a comment', async () => {
      createFile(dir, 'app.R', `${noValidation}# TODO use req( and validate( here\n`);
      expect(await idsFor(dir, 'shiny')).toContain('shiny-validation');
    });

    it('does not fire when the app never reads input', async () => {
      createFile(
        dir,
        'app.R',
        'library(shiny)\nui <- fluidPage("hi")\nserver <- function(input, output) {}\n'
      );
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-validation');
    });

    it('does not fire when input$ appears only in a comment or when there are no sources', async () => {
      createFile(dir, 'app.R', '# uses input$n later\nlibrary(shiny)\n');
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-validation');
    });

    it('handles CRLF and empty files without error', async () => {
      createFile(dir, 'app.R', noValidation.replace(/\n/g, '\r\n'));
      createFile(dir, 'server.R', '');
      expect(await idsFor(dir, 'shiny')).toContain('shiny-validation');
    });
  });

  describe('shiny-modules', () => {
    it('reports a source of more than 300 lines without modules', async () => {
      createFile(dir, 'app.R', lines(301));
      const found = (await findingsFor(dir, 'shiny')).filter((f) => f.id === 'shiny-modules');
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('recommended');
      expect(found[0].category).toBe('structure');
      expect(found[0].message.length).toBeGreaterThan(0);
      expect(found[0].suggestions?.length).toBeGreaterThan(0);
    });

    it('sums lines across app.R and R/ files', async () => {
      createFile(dir, 'app.R', lines(150));
      createFile(dir, 'R/helpers.R', lines(151));
      expect(await idsFor(dir, 'shiny')).toContain('shiny-modules');
    });

    it('does not fire at exactly 300 lines', async () => {
      createFile(dir, 'app.R', lines(300));
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-modules');
    });

    it('does not fire at 300 lines with CRLF line endings', async () => {
      createFile(dir, 'app.R', lines(300).replace(/\n/g, '\r\n'));
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-modules');
    });

    it.each(['moduleServer(id, function(input, output, session) {})', 'callModule(mod, "a")'])(
      'is satisfied by %s',
      async (snippet) => {
        createFile(dir, 'app.R', lines(350) + snippet + '\n');
        expect(await idsFor(dir, 'shiny')).not.toContain('shiny-modules');
      }
    );

    it('is not satisfied by a keyword only in a comment', async () => {
      createFile(dir, 'app.R', lines(350) + '# consider moduleServer( later\n');
      expect(await idsFor(dir, 'shiny')).toContain('shiny-modules');
    });

    it('does not fire for an empty project', async () => {
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-modules');
    });
  });

  describe('shiny-separation', () => {
    const app = (n: number, extra = ''): string =>
      `library(shiny)\n${extra}ui <- fluidPage()\nserver <- function(input, output, session) {}\n` +
      lines(n);

    it('reports a long single-file app.R', async () => {
      createFile(dir, 'app.R', app(210));
      const found = (await findingsFor(dir, 'shiny')).filter((f) => f.id === 'shiny-separation');
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('recommended');
      expect(found[0].category).toBe('structure');
      expect(found[0].message.length).toBeGreaterThan(0);
      expect(found[0].suggestions?.length).toBeGreaterThan(0);
      expect(found[0].file).toBe(`${dir}/app.R`);
    });

    it('does not fire at exactly 200 lines', async () => {
      createFile(dir, 'app.R', app(197)); // 3 header lines + 197 = 200
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-separation');
    });

    it('does not fire when there is an R/ directory', async () => {
      createFile(dir, 'app.R', app(210));
      createDir(dir, 'R');
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-separation');
    });

    it.each(['ui.R', 'server.R'])('does not fire when %s exists', async (name) => {
      createFile(dir, 'app.R', app(210));
      createFile(dir, name, '# file\n');
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-separation');
    });

    it('does not fire when app.R uses source()', async () => {
      createFile(dir, 'app.R', app(210, 'source("helpers.R")\n'));
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-separation');
    });

    it('does not fire when app.R defines neither ui nor server', async () => {
      createFile(dir, 'app.R', lines(250).replace('x <- 1', 'y <- 2'));
      expect(await idsFor(dir, 'shiny')).not.toContain('shiny-separation');
    });
  });

  it('does not run shiny rules for other workflows', async () => {
    createFile(dir, 'app.R', lines(400, 'z <- input$x'));
    const ids = await idsFor(dir, 'r-script');
    expect(ids).not.toContain('shiny-validation');
    expect(ids).not.toContain('shiny-modules');
  });
});
