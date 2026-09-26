import { WorkflowDetector } from '../src/engine/detector';
import { Validator } from '../src/engine/validator';
import { TemplateGenerator } from '../src/engine/template-generator';
import { metricsCollector } from '../src/utils/metrics';
import {
  createTempDir,
  cleanupTempDir,
  createShinyFixture,
  createPackageFixture,
  createQuartoFixture,
  createRScriptFixture,
  createPlumberFixture,
} from './fixtures/setup';

/**
 * Performance Benchmarking Suite
 * Tests performance characteristics of key operations
 */

describe('Performance Benchmarks', () => {
  let tempDir: string;
  let detector: WorkflowDetector;
  let validator: Validator;
  let templateGenerator: TemplateGenerator;

  beforeEach(() => {
    detector = new WorkflowDetector();
    validator = new Validator();
    templateGenerator = new TemplateGenerator();
    tempDir = createTempDir();
    metricsCollector.reset();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('Detection Performance', () => {
    it('should detect Shiny app within acceptable time', async () => {
      createShinyFixture(tempDir);
      const startTime = Date.now();

      const result = await detector.detect(tempDir);

      const duration = Date.now() - startTime;
      expect(result.workflow).toBe('shiny');
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      console.log(`Shiny detection: ${duration}ms`);
    });

    it('should detect package within acceptable time', async () => {
      createPackageFixture(tempDir);
      const startTime = Date.now();

      const result = await detector.detect(tempDir);

      const duration = Date.now() - startTime;
      expect(result.workflow).toBe('package');
      expect(duration).toBeLessThan(1000);
      console.log(`Package detection: ${duration}ms`);
    });

    it('should detect Quarto within acceptable time', async () => {
      createQuartoFixture(tempDir);
      const startTime = Date.now();

      const result = await detector.detect(tempDir);

      const duration = Date.now() - startTime;
      expect(result.workflow).toBe('quarto');
      expect(duration).toBeLessThan(1000);
      console.log(`Quarto detection: ${duration}ms`);
    });

    it('should detect R script within acceptable time', async () => {
      createRScriptFixture(tempDir);
      const startTime = Date.now();

      const result = await detector.detect(tempDir);

      const duration = Date.now() - startTime;
      expect(result.workflow).toBe('r-script');
      expect(duration).toBeLessThan(500);
      console.log(`R script detection: ${duration}ms`);
    });

    it('should handle multiple detections efficiently', async () => {
      createShinyFixture(tempDir);
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await detector.detect(tempDir);
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`Average detection time (${iterations} iterations): ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(500);
    });
  });

  describe('Validation Performance', () => {
    it('should validate Shiny project within acceptable time', async () => {
      createShinyFixture(tempDir);
      const startTime = Date.now();

      const result = await validator.validateProject(tempDir, 'shiny');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      console.log(`Shiny validation: ${duration}ms`);
    });

    it('should validate package within acceptable time', async () => {
      createPackageFixture(tempDir);
      const startTime = Date.now();

      const result = await validator.validateProject(tempDir, 'package');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
      console.log(`Package validation: ${duration}ms`);
    });

    it('should validate file quickly', async () => {
      createRScriptFixture(tempDir);
      const rFile = `${tempDir}/script.R`;

      const startTime = Date.now();
      const findings = await validator.validateFile(rFile);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
      console.log(`File validation: ${duration}ms`);
    });

    it('should handle batch validation efficiently', async () => {
      createPackageFixture(tempDir);
      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await validator.validateProject(tempDir, 'package');
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`Average validation time (${iterations} iterations): ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(1000);
    });
  });

  describe('Template Generation Performance', () => {
    it('should generate Shiny template quickly', async () => {
      const startTime = Date.now();

      const result = await templateGenerator.generate('shiny', {
        projectName: 'test-app',
      });

      const duration = Date.now() - startTime;
      expect(result.files.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // Template generation is fast
      console.log(`Shiny template generation: ${duration}ms`);
    });

    it('should generate package template quickly', async () => {
      const startTime = Date.now();

      const result = await templateGenerator.generate('package', {
        projectName: 'testpkg',
      });

      const duration = Date.now() - startTime;
      expect(result.files.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500);
      console.log(`Package template generation: ${duration}ms`);
    });

    it('should generate Quarto template quickly', async () => {
      const startTime = Date.now();

      const result = await templateGenerator.generate('quarto', {
        projectName: 'analysis',
      });

      const duration = Date.now() - startTime;
      expect(result.files.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500);
      console.log(`Quarto template generation: ${duration}ms`);
    });

    it('should generate all templates within reasonable time', async () => {
      const workflows = ['r-script', 'shiny', 'package', 'quarto', 'rmarkdown'];
      const times: Record<string, number> = {};

      for (const workflow of workflows) {
        const start = Date.now();
        const result = await templateGenerator.generate(workflow as any, {
          projectName: 'test',
        });
        times[workflow] = Date.now() - start;

        expect(result.files.length).toBeGreaterThan(0);
        expect(times[workflow]).toBeLessThan(500);
      }

      console.log('Template generation times:', times);
    });
  });

  describe('Metrics Collection', () => {
    it('should initialize metrics collector with no errors', () => {
      const metrics = metricsCollector.getSnapshot();
      expect(metrics).toBeDefined();
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.requests).toBeDefined();
      expect(metrics.operations).toBeDefined();
      console.log('Metrics collector initialized');
    });

    it('should record operation metrics manually', () => {
      metricsCollector.recordOperation('detection', 45, true);
      metricsCollector.recordOperation('validation', 125, true);
      metricsCollector.recordOperation('template-generation', 8, true);

      const metrics = metricsCollector.getSnapshot();
      expect(metrics.operationCounts['detection']).toBe(1);
      expect(metrics.operationCounts['validation']).toBe(1);
      expect(metrics.operationCounts['template-generation']).toBe(1);
      console.log('Metrics snapshot:', metrics);
    });

    it('should calculate statistics correctly', () => {
      // Record multiple operations
      for (let i = 0; i < 10; i++) {
        metricsCollector.recordOperation('detection', 40 + Math.random() * 20, true);
      }

      const stats = metricsCollector.getStats('detection');
      expect(stats).not.toBeNull();
      if (stats) {
        expect(stats.min).toBeGreaterThanOrEqual(40);
        expect(stats.max).toBeGreaterThanOrEqual(stats.min);
        expect(stats.median).toBeGreaterThanOrEqual(stats.min);
        expect(stats.median).toBeLessThanOrEqual(stats.max);
        console.log('Detection stats:', stats);
      }
    });

    it('should calculate percentiles correctly', () => {
      // Record multiple operations
      for (let i = 0; i < 50; i++) {
        metricsCollector.recordOperation('validation', 100 + Math.random() * 50, true);
      }

      const p50 = metricsCollector.getPercentile('validation', 50);
      const p95 = metricsCollector.getPercentile('validation', 95);
      const p99 = metricsCollector.getPercentile('validation', 99);

      expect(p50).not.toBeNull();
      expect(p95).not.toBeNull();
      expect(p99).not.toBeNull();

      if (p50 && p95 && p99) {
        expect(p95).toBeGreaterThanOrEqual(p50);
        expect(p99).toBeGreaterThanOrEqual(p95);
        console.log(`Validation percentiles: p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, p99=${p99.toFixed(2)}ms`);
      }
    });

    it('should export metrics in multiple formats', () => {
      // Record some operations
      metricsCollector.recordOperation('detection', 45, true);
      metricsCollector.recordOperation('validation', 125, true);
      metricsCollector.recordRequest('/api/detect-workflow', 'POST', 200, 45);
      metricsCollector.recordRequest('/api/validate-project', 'POST', 200, 125);

      const jsonMetrics = metricsCollector.exportJSON();
      expect(jsonMetrics).toBeTruthy();
      expect(jsonMetrics).toContain('uptime');

      const requestsCSV = metricsCollector.exportRequestsCSV();
      expect(requestsCSV).toContain('endpoint');
      expect(requestsCSV).toContain('/api/detect-workflow');

      const operationsCSV = metricsCollector.exportOperationsCSV();
      expect(operationsCSV).toContain('operationType');
      expect(operationsCSV).toContain('detection');

      console.log('Metrics export successful');
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid sequential detection requests', async () => {
      createShinyFixture(tempDir);
      const iterations = 20;
      const startTime = Date.now();

      const results = await Promise.all(
        Array.from({ length: iterations }, () => detector.detect(tempDir)),
      );

      const totalDuration = Date.now() - startTime;
      expect(results).toHaveLength(iterations);
      expect(results.every((r) => r.workflow === 'shiny')).toBe(true);

      const avgTime = totalDuration / iterations;
      console.log(`20 detections total: ${totalDuration}ms, average: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(100); // Each should average under 100ms
    });

    it('should handle rapid sequential validations', async () => {
      createPackageFixture(tempDir);
      const iterations = 10;
      const startTime = Date.now();

      const results = await Promise.all(
        Array.from({ length: iterations }, () =>
          validator.validateProject(tempDir, 'package'),
        ),
      );

      const totalDuration = Date.now() - startTime;
      expect(results).toHaveLength(iterations);

      const avgTime = totalDuration / iterations;
      console.log(`10 validations total: ${totalDuration}ms, average: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(500);
    });

    it('should handle mixed operation load', async () => {
      createShinyFixture(tempDir);
      createPackageFixture(tempDir);

      const startTime = Date.now();

      const detections = Promise.all([
        detector.detect(tempDir),
        detector.detect(tempDir),
      ]);

      const validations = Promise.all([
        validator.validateProject(tempDir, 'shiny'),
        validator.validateProject(tempDir, 'package'),
      ]);

      const generations = Promise.all([
        templateGenerator.generate('shiny', {}),
        templateGenerator.generate('package', {}),
      ]);

      const results = await Promise.all([detections, validations, generations]);

      const totalDuration = Date.now() - startTime;
      console.log(
        `Mixed load (2 detections, 2 validations, 2 generations) completed in ${totalDuration}ms`,
      );
      expect(totalDuration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Comparison Against Baseline', () => {
    it('should meet expected performance baselines', async () => {
      const baselines = {
        detection: 100, // 100ms
        validation: 500, // 500ms
        'template-generation': 50, // 50ms
      };

      createShinyFixture(tempDir);

      // Detection
      let start = Date.now();
      await detector.detect(tempDir);
      let duration = Date.now() - start;
      expect(duration).toBeLessThan(baselines.detection * 2);

      // Validation
      start = Date.now();
      await validator.validateProject(tempDir, 'shiny');
      duration = Date.now() - start;
      expect(duration).toBeLessThan(baselines.validation * 2);

      // Template generation
      start = Date.now();
      await templateGenerator.generate('shiny', {});
      duration = Date.now() - start;
      expect(duration).toBeLessThan(baselines['template-generation'] * 2);

      console.log('All operations met baseline performance targets');
    });
  });
});
