import { Validator } from '../../src/engine/validator';
import {
  createTempDir,
  cleanupTempDir,
  createFile,
  createDir,
  createPackageFixture,
  createRenvFixture,
  createShinyFixture,
  createBookdownFixture,
  createBlogdownFixture,
  createShinytestFixture,
} from '../fixtures/setup';

describe('Validator', () => {
  let validator: Validator;
  let tempDir: string;

  beforeEach(() => {
    validator = new Validator();
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('validateProject', () => {
    it('should validate R package structure', async () => {
      createPackageFixture(tempDir);
      const result = await validator.validateProject(tempDir, 'package');

      expect(result.findings).toBeDefined();
      expect(result.workflow).toBe('package');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should detect missing DESCRIPTION in package', async () => {
      const result = await validator.validateProject(tempDir, 'package');
      const descError = result.findings.find((f) => f.id === 'pkg-description');

      expect(descError).toBeDefined();
      expect(descError?.severity).toBe('critical');
    });

    it('should validate renv projects', async () => {
      createRenvFixture(tempDir);
      const result = await validator.validateProject(tempDir, 'renv');

      expect(result.findings).toBeDefined();
      expect(result.workflow).toBe('renv');
    });

    it('should validate Shiny apps', async () => {
      createShinyFixture(tempDir);
      const result = await validator.validateProject(tempDir, 'shiny');

      expect(result.findings).toBeDefined();
      expect(result.workflow).toBe('shiny');
    });

    it('should apply severity filter', async () => {
      createPackageFixture(tempDir);
      const result = await validator.validateProject(tempDir, 'package', {
        minSeverity: 'critical',
      });

      expect(result.findings.every((f) => f.severity === 'critical')).toBe(true);
    });

    it('should apply max findings limit', async () => {
      createPackageFixture(tempDir);
      const result = await validator.validateProject(tempDir, 'package', {
        maxFindings: 2,
      });

      expect(result.findings.length).toBeLessThanOrEqual(2);
    });
  });

  describe('validateFile', () => {
    it('should validate R files', async () => {
      const filePath = `${tempDir}/test.R`;
      createFile(tempDir, 'test.R', 'print("hello")');
      const findings = await validator.validateFile(filePath);

      expect(findings).toBeDefined();
      expect(Array.isArray(findings)).toBe(true);
    });

    it('should validate Quarto files', async () => {
      const filePath = `${tempDir}/test.qmd`;
      createFile(tempDir, 'test.qmd', '```{r}\nprint("hello")\n```');
      const findings = await validator.validateFile(filePath);

      expect(findings).toBeDefined();
    });

    it('should detect missing YAML in Quarto', async () => {
      const filePath = `${tempDir}/test.qmd`;
      createFile(tempDir, 'test.qmd', '```{r}\nprint("hello")\n```');
      const findings = await validator.validateFile(filePath);

      const yamlError = findings.find((f) => f.id === 'quarto-yaml');
      expect(yamlError).toBeDefined();
    });

    it('should detect unlabeled code chunks', async () => {
      const filePath = `${tempDir}/test.qmd`;
      createFile(
        tempDir,
        'test.qmd',
        '---\ntitle: Test\n---\n\n```{r}\nprint("hello")\n```'
      );
      const findings = await validator.validateFile(filePath);

      const labelError = findings.find((f) => f.id === 'quarto-labels');
      expect(labelError).toBeDefined();
    });

    it('should validate R Markdown files', async () => {
      const filePath = `${tempDir}/test.Rmd`;
      createFile(tempDir, 'test.Rmd', 'Test');
      const findings = await validator.validateFile(filePath);

      expect(findings).toBeDefined();
    });
  });

  describe('validation by workflow', () => {
    it('should detect missing package files', async () => {
      const result = await validator.validateProject(tempDir, 'package');
      const missing = result.findings.filter((f) =>
        ['pkg-description', 'pkg-license'].includes(f.id)
      );
      expect(missing.length).toBeGreaterThan(0);
    });

    it('should detect missing renv.lock', async () => {
      const result = await validator.validateProject(tempDir, 'renv');
      const lockError = result.findings.find((f) => f.id === 'renv-lock');
      expect(lockError?.severity).toBe('critical');
    });

    it('should check Shiny app structure', async () => {
      const result = await validator.validateProject(tempDir, 'shiny');
      const findings = result.findings;
      expect(findings.length).toBeGreaterThan(0);
    });

    it('should validate analysis directory structure', async () => {
      const result = await validator.validateProject(tempDir, 'analysis');
      const structureErrors = result.findings.filter((f) => f.id === 'analysis-structure');
      expect(structureErrors.length).toBeGreaterThan(0);
    });

    it('should validate bookdown structure', async () => {
      createBookdownFixture(tempDir);
      const result = await validator.validateProject(tempDir, 'bookdown');

      expect(result.findings).toBeDefined();
      expect(result.workflow).toBe('bookdown');
    });

    it('should detect missing _bookdown.yaml in bookdown', async () => {
      const result = await validator.validateProject(tempDir, 'bookdown');
      const configError = result.findings.find((f) => f.id === 'bookdown-config');

      expect(configError).toBeDefined();
      expect(configError?.severity).toBe('critical');
    });

    it('should validate blogdown site', async () => {
      createBlogdownFixture(tempDir);
      const result = await validator.validateProject(tempDir, 'blogdown');

      expect(result.findings).toBeDefined();
      expect(result.workflow).toBe('blogdown');
    });

    it('should detect missing config in blogdown', async () => {
      const result = await validator.validateProject(tempDir, 'blogdown');
      const configError = result.findings.find((f) => f.id === 'blogdown-config');

      expect(configError).toBeDefined();
      expect(configError?.severity).toBe('critical');
    });

    it('should validate shinytest structure', async () => {
      createShinytestFixture(tempDir);
      const result = await validator.validateProject(tempDir, 'shinytest');

      expect(result.findings).toBeDefined();
      expect(result.workflow).toBe('shinytest');
    });

    it('should detect missing tests/shinytest in shinytest', async () => {
      const result = await validator.validateProject(tempDir, 'shinytest');
      const testError = result.findings.find((f) => f.id === 'shinytest-structure');

      expect(testError).toBeDefined();
      expect(testError?.severity).toBe('important');
    });
  });

  describe('finding properties', () => {
    it('should include severity and category', async () => {
      const result = await validator.validateProject(tempDir, 'package');
      const findings = result.findings.filter((f) => f.severity === 'critical');

      findings.forEach((f) => {
        expect(f.severity).toBeDefined();
        expect(f.category).toBeDefined();
        expect(f.message).toBeDefined();
      });
    });

    it('should include suggestions when available', async () => {
      const result = await validator.validateProject(tempDir, 'renv');
      const withSuggestions = result.findings.filter((f) => f.suggestions);

      expect(withSuggestions.length).toBeGreaterThan(0);
    });
  });
});
