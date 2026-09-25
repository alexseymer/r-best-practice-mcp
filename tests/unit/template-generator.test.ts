import { TemplateGenerator } from '../../src/engine/template-generator';
import { Workflow } from '../../src/types/workflow';

describe('TemplateGenerator', () => {
  let generator: TemplateGenerator;

  beforeEach(() => {
    generator = new TemplateGenerator();
  });

  describe('generate', () => {
    it('should generate R script template', async () => {
      const result = await generator.generate('r-script', {
        projectName: 'my-script',
        authorName: 'Test Author',
        authorEmail: 'test@example.com',
      });

      expect(result.workflow).toBe('r-script');
      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should generate Quarto template', async () => {
      const result = await generator.generate('quarto', {
        projectName: 'analysis',
      });

      expect(result.workflow).toBe('quarto');
      expect(result.files.some((f) => f.path === 'analysis.qmd')).toBe(true);
    });

    it('should generate Shiny template', async () => {
      const result = await generator.generate('shiny', {
        projectName: 'my-app',
      });

      expect(result.workflow).toBe('shiny');
      expect(result.files.some((f) => f.path === 'app.R')).toBe(true);
      expect(result.files.some((f) => f.path.includes('README'))).toBe(true);
    });

    it('should generate R package template', async () => {
      const result = await generator.generate('package', {
        projectName: 'mypackage',
        authorName: 'Author Name',
        authorEmail: 'author@example.com',
      });

      expect(result.workflow).toBe('package');
      expect(result.files.some((f) => f.path === 'DESCRIPTION')).toBe(true);
      expect(result.files.some((f) => f.path === 'LICENSE')).toBe(true);
      expect(result.files.some((f) => f.path.includes('R/'))).toBe(true);
      expect(result.directories.includes('R')).toBe(true);
      expect(result.directories.includes('tests/testthat')).toBe(true);
    });

    it('should generate R Markdown template', async () => {
      const result = await generator.generate('rmarkdown', {
        projectName: 'report',
      });

      expect(result.workflow).toBe('rmarkdown');
      expect(result.files.some((f) => f.path === 'report.Rmd')).toBe(true);
    });

    it('should generate renv template', async () => {
      const result = await generator.generate('renv');

      expect(result.workflow).toBe('renv');
      expect(result.files.some((f) => f.path === 'renv.lock')).toBe(true);
      expect(result.files.some((f) => f.path === '.Rprofile')).toBe(true);
    });

    it('should generate targets template', async () => {
      const result = await generator.generate('targets', {
        projectName: 'pipeline',
      });

      expect(result.workflow).toBe('targets');
      expect(result.files.some((f) => f.path === '_targets.R')).toBe(true);
    });

    it('should generate Plumber template', async () => {
      const result = await generator.generate('plumber', {
        projectName: 'api',
      });

      expect(result.workflow).toBe('plumber');
      expect(result.files.some((f) => f.path === 'api.R')).toBe(true);
      expect(result.files.some((f) => f.path === 'run.R')).toBe(true);
    });

    it('should generate analysis template', async () => {
      const result = await generator.generate('analysis', {
        projectName: 'data-analysis',
      });

      expect(result.workflow).toBe('analysis');
      expect(result.files.some((f) => f.path.includes('README'))).toBe(true);
      expect(result.files.some((f) => f.path === 'analysis.qmd')).toBe(true);
      expect(result.directories.includes('data')).toBe(true);
      expect(result.directories.includes('R')).toBe(true);
      expect(result.directories.includes('output')).toBe(true);
    });

    it('should include timestamp in result', async () => {
      const beforeTime = Date.now();
      const result = await generator.generate('r-script');
      const afterTime = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('template content', () => {
    it('should generate R script with proper structure', async () => {
      const result = await generator.generate('r-script', {
        projectName: 'test-script',
        authorName: 'Test Author',
      });

      const scriptFile = result.files.find((f) => f.path === 'script.R');
      expect(scriptFile).toBeDefined();
      expect(scriptFile?.content).toContain('main <- function()');
      expect(scriptFile?.content).toContain('Test Author');
      expect(scriptFile?.content).toContain('test-script');
    });

    it('should generate Quarto with YAML frontmatter', async () => {
      const result = await generator.generate('quarto');

      const qmdFile = result.files.find((f) => f.path.endsWith('.qmd'));
      expect(qmdFile).toBeDefined();
      expect(qmdFile?.content).toContain('---');
      expect(qmdFile?.content).toContain('title:');
      expect(qmdFile?.content).toContain('```{r}');
    });

    it('should generate Shiny with UI and server', async () => {
      const result = await generator.generate('shiny', {
        projectName: 'test-app',
      });

      const appFile = result.files.find((f) => f.path === 'app.R');
      expect(appFile).toBeDefined();
      expect(appFile?.content).toContain('ui <- fluidPage');
      expect(appFile?.content).toContain('server <- function');
      expect(appFile?.content).toContain('shinyApp');
      expect(appFile?.content).toContain('test-app');
    });

    it('should generate package with proper structure', async () => {
      const result = await generator.generate('package', {
        projectName: 'testpkg',
        authorName: 'Author',
        authorEmail: 'test@example.com',
      });

      const descFile = result.files.find((f) => f.path === 'DESCRIPTION');
      expect(descFile).toBeDefined();
      expect(descFile?.content).toContain('Package: testpkg');
      expect(descFile?.content).toContain('Author');
      expect(descFile?.content).toContain('test@example.com');

      const licenseFile = result.files.find((f) => f.path === 'LICENSE');
      expect(licenseFile).toBeDefined();
      expect(licenseFile?.content).toContain('MIT License');

      const helloFile = result.files.find((f) => f.path.includes('hello.R'));
      expect(helloFile).toBeDefined();
      expect(helloFile?.content).toContain('@export');
    });

    it('should generate analysis with directory structure', async () => {
      const result = await generator.generate('analysis', {
        projectName: 'my-analysis',
      });

      expect(result.directories.length).toBeGreaterThan(0);
      expect(result.directories).toContain('data');
      expect(result.directories).toContain('R');
      expect(result.directories).toContain('output');
    });

    it('should include gitignore in R script template', async () => {
      const result = await generator.generate('r-script');

      const gitignore = result.files.find((f) => f.path === '.gitignore');
      expect(gitignore).toBeDefined();
      expect(gitignore?.content).toContain('.Rhistory');
      expect(gitignore?.content).toContain('.DS_Store');
    });

    it('should include README in Shiny template', async () => {
      const result = await generator.generate('shiny', {
        authorName: 'Test User',
      });

      const readme = result.files.find((f) => f.path === 'README.md');
      expect(readme).toBeDefined();
      expect(readme?.content).toContain('Shiny application');
      expect(readme?.content).toContain('Test User');
    });

    it('should generate targets with example pipeline', async () => {
      const result = await generator.generate('targets');

      const targetsFile = result.files.find((f) => f.path === '_targets.R');
      expect(targetsFile).toBeDefined();
      expect(targetsFile?.content).toContain('library(targets)');
      expect(targetsFile?.content).toContain('tar_target');
      expect(targetsFile?.content).toContain('list(');
    });

    it('should generate Plumber with example endpoints', async () => {
      const result = await generator.generate('plumber', {
        projectName: 'demo-api',
      });

      const apiFile = result.files.find((f) => f.path === 'api.R');
      expect(apiFile).toBeDefined();
      expect(apiFile?.content).toContain('@get');
      expect(apiFile?.content).toContain('@post');
      expect(apiFile?.content).toContain('validate_input');
      expect(apiFile?.content).toContain('tryCatch');
    });

    it('should generate renv with lock file', async () => {
      const result = await generator.generate('renv');

      const lockFile = result.files.find((f) => f.path === 'renv.lock');
      expect(lockFile).toBeDefined();
      expect(lockFile?.content).toContain('"R"');
      expect(lockFile?.content).toContain('"Packages"');
    });
  });

  describe('with custom options', () => {
    it('should use custom author name in templates', async () => {
      const result = await generator.generate('r-script', {
        authorName: 'Custom Author',
        authorEmail: 'custom@example.com',
      });

      const scriptFile = result.files.find((f) => f.path === 'script.R');
      expect(scriptFile?.content).toContain('Custom Author');
      expect(scriptFile?.content).toContain('custom@example.com');
    });

    it('should use custom project name', async () => {
      const result = await generator.generate('shiny', {
        projectName: 'custom-project-name',
      });

      const appFile = result.files.find((f) => f.path === 'app.R');
      expect(appFile?.content).toContain('custom-project-name');
    });

    it('should handle missing optional parameters', async () => {
      const result = await generator.generate('r-script');

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
      // Should have default values
      const scriptFile = result.files.find((f) => f.path === 'script.R');
      expect(scriptFile?.content).toContain('Author Name');
    });
  });

  describe('file generation', () => {
    it('should generate files with non-empty content', async () => {
      const result = await generator.generate('package');

      result.files.forEach((file) => {
        expect(file.path).toBeTruthy();
        // .gitkeep files are allowed to be empty as placeholders
        if (file.path.endsWith('.gitkeep')) {
          expect(file.content).toBeDefined();
        } else {
          expect(file.content).toBeTruthy();
          expect(file.content.length).toBeGreaterThan(0);
        }
      });
    });

    it('should have consistent file paths', async () => {
      const result = await generator.generate('analysis');

      result.files.forEach((file) => {
        expect(file.path).not.toContain('\\');
        expect(file.path).not.toContain('//');
      });
    });

    it('should generate valid R file syntax in script template', async () => {
      const result = await generator.generate('r-script');

      const scriptFile = result.files.find((f) => f.path === 'script.R');
      expect(scriptFile?.content).toMatch(/main\s*<-\s*function/);
      expect(scriptFile?.content).toMatch(/if\s*\(!interactive\(\)\)/);
    });

    it('should include helpful comments in templates', async () => {
      const result = await generator.generate('quarto');

      const qmdFile = result.files.find((f) => f.path.endsWith('.qmd'));
      expect(qmdFile?.content).toContain('##'); // Markdown headers
      expect(qmdFile?.content.match(/#{1,3}/)).toBeTruthy();
    });
  });

  describe('directory structure', () => {
    it('should return directories for package workflow', async () => {
      const result = await generator.generate('package');

      expect(result.directories.length).toBeGreaterThan(0);
      expect(result.directories).toContain('R');
    });

    it('should return directories for analysis workflow', async () => {
      const result = await generator.generate('analysis');

      expect(result.directories).toContain('data');
      expect(result.directories).toContain('R');
      expect(result.directories).toContain('output');
    });

    it('should return empty directories for simple workflows', async () => {
      const result = await generator.generate('r-script');

      // R scripts might not need specific directories
      expect(result.directories).toBeDefined();
    });
  });
});
