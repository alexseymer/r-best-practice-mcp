import { WorkflowDetector } from '../../src/engine/detector';
import {
  createTempDir,
  cleanupTempDir,
  createShinyFixture,
  createQuartoFixture,
  createRScriptFixture,
  createPackageFixture,
  createRenvFixture,
  createTargetsFixture,
  createPlumberFixture,
} from '../fixtures/setup';

describe('WorkflowDetector', () => {
  let detector: WorkflowDetector;
  let tempDir: string;

  beforeEach(() => {
    detector = new WorkflowDetector();
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('detect', () => {
    it('should detect Shiny apps with app.R', async () => {
      createShinyFixture(tempDir);
      const result = await detector.detect(tempDir);

      expect(result.workflow).toBe('shiny');
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it('should detect Quarto documents', async () => {
      createQuartoFixture(tempDir);
      const result = await detector.detect(tempDir);

      expect(result.workflow).toBe('quarto');
      expect(result.confidence).toBeGreaterThan(50);
    });

    it('should detect R packages', async () => {
      createPackageFixture(tempDir);
      const result = await detector.detect(tempDir);

      expect(result.workflow).toBe('package');
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.indicators).toContain('DESCRIPTION and R/ found');
    });

    it('should detect renv projects', async () => {
      createRenvFixture(tempDir);
      const result = await detector.detect(tempDir);

      expect(result.workflow).toBe('renv');
      expect(result.confidence).toBeGreaterThan(50);
    });

    it('should detect targets pipelines', async () => {
      createTargetsFixture(tempDir);
      const result = await detector.detect(tempDir);

      expect(result.workflow).toBe('targets');
      expect(result.confidence).toBeGreaterThan(50);
    });

    it('should detect Plumber APIs', async () => {
      createPlumberFixture(tempDir);
      const result = await detector.detect(tempDir);

      expect(result.workflow).toBe('plumber');
      expect(result.confidence).toBeGreaterThan(50);
    });

    it('should return unknown for non-existent directory', async () => {
      const result = await detector.detect('/nonexistent/path');

      expect(result.workflow).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should include timestamp in result', async () => {
      const result = await detector.detect(tempDir);
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });
});
