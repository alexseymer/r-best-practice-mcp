import { WorkflowDetector } from '../../src/engine/detector.js';
import { Validator } from '../../src/engine/validator.js';
import { TemplateGenerator } from '../../src/engine/template-generator.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Performance and Load Tests', () => {
  const detector = new WorkflowDetector();
  const validator = new Validator();
  const templateGenerator = new TemplateGenerator();
  const examplePackagePath = path.resolve(__dirname, '../../examples/example-package');

  // Performance measurement helper
  const measureTime = async (fn: () => Promise<any>): Promise<{ result: any; duration: number }> => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return { result, duration: end - start };
  };

  describe('Detection Performance', () => {
    it('should detect workflow in < 200ms', async () => {
      const { duration } = await measureTime(() => detector.detect(examplePackagePath));
      expect(duration).toBeLessThan(200);
    });

    it('should handle concurrent detections', async () => {
      const paths = [examplePackagePath, examplePackagePath, examplePackagePath];
      const start = performance.now();

      const results = await Promise.all(
        paths.map(p => detector.detect(p))
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(3);
      expect(duration).toBeLessThan(500); // All 3 should complete quickly
      results.forEach(r => expect(r.workflow).toBe('package'));
    });

    it('should detect 10 projects concurrently', async () => {
      const paths = Array(10).fill(examplePackagePath);
      const start = performance.now();

      const results = await Promise.all(
        paths.map(p => detector.detect(p))
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(1000); // Should handle 10 concurrently
    });

    it('should detect 50 projects concurrently', async () => {
      const paths = Array(50).fill(examplePackagePath);
      const start = performance.now();

      const results = await Promise.all(
        paths.map(p => detector.detect(p))
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(50);
      console.log(`Time to detect 50 projects: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(3000); // Should handle 50 concurrently
    });
  });

  describe('Validation Performance', () => {
    it('should validate project in < 500ms', async () => {
      const { duration } = await measureTime(() =>
        validator.validateProject(examplePackagePath, 'package')
      );
      expect(duration).toBeLessThan(500);
    });

    it('should handle concurrent project validations', async () => {
      const start = performance.now();

      const results = await Promise.all([
        validator.validateProject(examplePackagePath, 'package'),
        validator.validateProject(examplePackagePath, 'package'),
        validator.validateProject(examplePackagePath, 'package'),
      ]);

      const duration = performance.now() - start;

      expect(results).toHaveLength(3);
      expect(duration).toBeLessThan(1000);
      results.forEach(r => expect(r.findings).toBeDefined());
    });

    it('should validate 5 projects concurrently', async () => {
      const start = performance.now();

      const results = await Promise.all(
        Array(5).fill(null).map(() => validator.validateProject(examplePackagePath, 'package'))
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(2000);
    });

    it('should validate file in < 100ms', async () => {
      const filePath = path.resolve(__dirname, '../../examples/example-package/R/statistics.R');
      const { duration } = await measureTime(() =>
        validator.validateFile(filePath)
      );
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent file validations', async () => {
      const filePath = path.resolve(__dirname, '../../examples/example-package/R/statistics.R');
      const start = performance.now();

      const results = await Promise.all(
        Array(10).fill(null).map(() => validator.validateFile(filePath))
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Template Generation Performance', () => {
    it('should generate package template in < 50ms', async () => {
      const { duration } = await measureTime(() =>
        templateGenerator.generate('package', {})
      );
      expect(duration).toBeLessThan(50);
    });

    it('should generate multiple templates quickly', async () => {
      const workflows = ['package', 'shiny', 'quarto', 'r-script', 'analysis'];
      const start = performance.now();

      const results = await Promise.all(
        workflows.map(w => templateGenerator.generate(w as any, {}))
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(200);
    });

    it('should handle concurrent template generation', async () => {
      const start = performance.now();

      const results = await Promise.all(
        Array(20).fill(null).map(() => templateGenerator.generate('package', {}))
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(20);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Combined Workflow Load Tests', () => {
    it('should handle mixed concurrent operations', async () => {
      const start = performance.now();

      const results = await Promise.all([
        // Detection requests
        ...Array(10).fill(null).map(() => detector.detect(examplePackagePath)),
        // Validation requests
        ...Array(5).fill(null).map(() => validator.validateProject(examplePackagePath, 'package')),
        // Template generation requests
        ...Array(5).fill(null).map(() => templateGenerator.generate('package', {})),
      ]);

      const duration = performance.now() - start;

      expect(results).toHaveLength(20);
      console.log(`Time for 20 mixed concurrent operations: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(2000);
    });

    it('should handle high throughput detection', async () => {
      const concurrency = 100;
      const start = performance.now();

      const results = await Promise.all(
        Array(concurrency).fill(null).map(() => detector.detect(examplePackagePath))
      );

      const duration = performance.now() - start;
      const throughput = (concurrency / (duration / 1000)).toFixed(2);

      console.log(`Detection throughput: ${throughput} operations/second`);
      expect(results).toHaveLength(concurrency);
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Large Project Handling', () => {
    let largeTempDir: string;

    beforeAll(async () => {
      // Create a temporary large-ish project structure
      largeTempDir = path.resolve(__dirname, '../../', '.test-large-project');
      await fs.mkdir(largeTempDir, { recursive: true });
      await fs.mkdir(path.join(largeTempDir, 'R'), { recursive: true });
      await fs.mkdir(path.join(largeTempDir, 'data'), { recursive: true });

      // Create multiple R files
      for (let i = 0; i < 20; i++) {
        await fs.writeFile(
          path.join(largeTempDir, 'R', `file${i}.R`),
          `# File ${i}\ncat("Hello")\n`
        );
      }

      // Create DESCRIPTION file for package detection
      await fs.writeFile(
        path.join(largeTempDir, 'DESCRIPTION'),
        `Package: testpkg\nVersion: 0.1.0\nTitle: Test Package\n`
      );

      // Create NAMESPACE
      await fs.writeFile(
        path.join(largeTempDir, 'NAMESPACE'),
        `# Automatically generated\n`
      );
    });

    afterAll(async () => {
      // Clean up
      try {
        const rimraf = (dir: string): Promise<void> =>
          fs.rm(dir, { recursive: true, force: true });
        await rimraf(largeTempDir);
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    it('should handle large project detection', async () => {
      const { duration, result } = await measureTime(() =>
        detector.detect(largeTempDir)
      );

      expect(result.workflow).toBe('package');
      expect(duration).toBeLessThan(500);
    });

    it('should handle large project validation', async () => {
      const { duration, result } = await measureTime(() =>
        validator.validateProject(largeTempDir, 'package')
      );

      expect(result.findings).toBeDefined();
      expect(duration).toBeLessThan(1000);
    });

    it('should validate multiple files from large project concurrently', async () => {
      const rFiles = Array(10).fill(null).map((_, i) =>
        path.join(largeTempDir, 'R', `file${i}.R`)
      );

      const start = performance.now();

      const results = await Promise.all(
        rFiles.map(f => validator.validateFile(f))
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Stress Test - High Concurrency', () => {
    it('should handle 200 concurrent operations without errors', async () => {
      const operations = Array(200).fill(null).map((_, i) => {
        const type = i % 3;
        switch (type) {
          case 0:
            return detector.detect(examplePackagePath);
          case 1:
            return templateGenerator.generate('package', {});
          default:
            return validator.validateFile(
              path.resolve(__dirname, '../../examples/example-package/R/statistics.R')
            );
        }
      });

      const start = performance.now();
      const results = await Promise.all(operations);
      const duration = performance.now() - start;

      expect(results).toHaveLength(200);
      expect(results.every(r => r !== undefined)).toBe(true);
      console.log(`Time for 200 mixed operations: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should not have excessive memory growth with many operations', async () => {
      const beforeMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

      // Perform 1000 quick operations
      const operations = Array(1000).fill(null).map(() =>
        templateGenerator.generate('package', {})
      );

      await Promise.all(operations);

      const afterMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      const memoryIncrease = afterMemory - beforeMemory;

      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);

      // Should not increase by more than 100MB for 1000 template generations
      expect(memoryIncrease).toBeLessThan(100);
    });
  });
});
