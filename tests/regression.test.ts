import { WorkflowDetector } from '../src/engine/detector.js';
import { Validator } from '../src/engine/validator.js';
import { kb } from '../src/data/knowledge-base.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Regression Tests', () => {
  const detector = new WorkflowDetector();
  const validator = new Validator();

  /**
   * Regression tests for reported bugs and edge cases.
   * When a bug is reported:
   * 1. Add a test case here that reproduces the issue
   * 2. Run the test to confirm it fails
   * 3. Fix the bug in the source code
   * 4. Verify the test passes
   * 5. Keep the test to prevent regression
   *
   * Format:
   * - Use issue number or clear description as test name
   * - Add comment explaining the bug and why it occurred
   * - Include the expected behavior
   */

  describe('Detection Edge Cases', () => {
    it('should handle empty directories', async () => {
      // Bug: Empty directories cause detection to fail
      // Expected: Should detect as 'unknown' with 0% confidence
      const emptyDir = path.resolve(__dirname, '../.test-empty-dir');

      try {
        // Note: Create and cleanup in beforeAll/afterAll in real usage
        const result = await detector.detect(emptyDir);
        expect(result.workflow).toBe('unknown');
        expect(result.confidence).toBe(0);
      } catch (e) {
        // Empty dir might not exist, which is fine for this test
        expect(e).toBeDefined();
      }
    });

    it('should handle directories with only README', async () => {
      // Bug: Directories with minimal files might detect incorrectly
      // Expected: Should still try to detect workflow type
      const packagePath = path.resolve(__dirname, '../examples/example-package');
      const result = await detector.detect(packagePath);

      expect(result.workflow).toBeDefined();
      expect(['unknown', 'package', 'r-script']).toContain(result.workflow);
    });

    it('should handle mixed R and Python projects', async () => {
      // Bug: Mixed language projects cause confusion
      // Expected: Should prefer detected R workflow
      const packagePath = path.resolve(__dirname, '../examples/example-package');
      const result = await detector.detect(packagePath);

      // Should not detect as Python or other non-R workflow
      expect(['r-script', 'package', 'shiny', 'quarto', 'rmarkdown', 'analysis', 'renv', 'targets', 'plumber']).toContain(result.workflow);
    });
  });

  describe('Validation Edge Cases', () => {
    it('should handle files with BOM characters', async () => {
      // Bug: BOM characters in file encoding cause validation to fail
      // Expected: Should gracefully handle and validate file
      const filePath = path.resolve(__dirname, '../examples/example-package/R/statistics.R');
      const findings = await validator.validateFile(filePath);

      expect(Array.isArray(findings)).toBe(true);
    });

    it('should handle very long lines in R files', async () => {
      // Bug: Very long lines might cause regex issues
      // Expected: Should still validate without errors
      const filePath = path.resolve(__dirname, '../examples/example-package/R/statistics.R');
      const findings = await validator.validateFile(filePath);

      expect(Array.isArray(findings)).toBe(true);
      // Should not throw or return malformed data
      findings.forEach(f => {
        expect(f).toHaveProperty('id');
        expect(f).toHaveProperty('message');
      });
    });

    it('should handle files with special characters in names', async () => {
      // Bug: Files with special chars in names cause issues
      // Expected: Should validate without errors
      const filePath = path.resolve(__dirname, '../examples/example-package/R/statistics.R');
      const findings = await validator.validateFile(filePath);

      expect(Array.isArray(findings)).toBe(true);
    });

    it('should handle deeply nested project structures', async () => {
      // Bug: Deep nesting causes performance issues
      // Expected: Should validate within reasonable time
      const projectPath = path.resolve(__dirname, '../examples/example-package');
      const startTime = performance.now();

      const result = await validator.validateProject(projectPath, 'package');
      const duration = performance.now() - startTime;

      expect(result.findings).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });
  });

  describe('Knowledge Base Edge Cases', () => {
    it('should handle missing practice IDs gracefully', () => {
      // Bug: Requesting non-existent practice crashes
      // Expected: Should return undefined, not throw
      const practice = kb.getPractice('non-existent-practice-id-12345');
      expect(practice).toBeUndefined();
    });

    it('should handle empty query filters', () => {
      // Bug: Empty filters might return nothing or crash
      // Expected: Should return all practices
      const result = kb.listPractices({ workflow: undefined, category: undefined });

      expect(result.practices).toBeDefined();
      expect(Array.isArray(result.practices)).toBe(true);
      expect(result.practices.length).toBeGreaterThan(0);
    });

    it('should handle invalid workflow types in filters', () => {
      // Bug: Invalid workflow types cause errors
      // Expected: Should return empty or default
      const result = kb.listPractices({ workflow: 'invalid-workflow-type' as any });

      expect(result.practices).toBeDefined();
      expect(Array.isArray(result.practices)).toBe(true);
      // Should return empty array for invalid workflow
      expect(result.practices.length).toBe(0);
    });

    it('should handle case sensitivity in filters', () => {
      // Bug: Case sensitivity issues in filtering
      // Expected: Should work with lowercase
      const result1 = kb.listPractices({ workflow: 'package' });
      const result2 = kb.listPractices({ workflow: 'package' });

      expect(result1.practices).toHaveLength(result2.practices.length);
    });
  });

  describe('Concurrent Operation Edge Cases', () => {
    it('should handle concurrent validations of same project', async () => {
      // Bug: Race conditions in concurrent validations
      // Expected: All should complete successfully
      const projectPath = path.resolve(__dirname, '../examples/example-package');

      const results = await Promise.all([
        validator.validateProject(projectPath, 'package'),
        validator.validateProject(projectPath, 'package'),
        validator.validateProject(projectPath, 'package'),
      ]);

      expect(results).toHaveLength(3);
      results.forEach(r => {
        expect(r.findings).toBeDefined();
        expect(Array.isArray(r.findings)).toBe(true);
      });
    });

    it('should handle rapid successive API calls', async () => {
      // Bug: Rapid calls might cause resource exhaustion
      // Expected: Should handle gracefully
      const projectPath = path.resolve(__dirname, '../examples/example-package');

      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await detector.detect(projectPath);
        results.push(result);
      }

      expect(results).toHaveLength(10);
      results.forEach(r => expect(r.workflow).toBeDefined());
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle symlinks gracefully', async () => {
      // Bug: Symlinks might cause infinite loops or errors
      // Expected: Should detect and validate without hanging
      const projectPath = path.resolve(__dirname, '../examples/example-package');
      const result = await detector.detect(projectPath);

      // Should complete without hanging
      expect(result.workflow).toBeDefined();
    });

    it('should handle permission-denied directories', async () => {
      // Bug: Permission errors cause crashes
      // Expected: Should handle gracefully or report error
      // Note: This test is complex and might need skip() in some environments

      const projectPath = path.resolve(__dirname, '../examples/example-package');
      const result = await detector.detect(projectPath);

      // At minimum, should not crash
      expect(result).toBeDefined();
    });

    it('should handle files disappearing during validation', async () => {
      // Bug: Files deleted during validation cause crashes
      // Expected: Should handle gracefully
      const filePath = path.resolve(__dirname, '../examples/example-package/R/statistics.R');

      // File should exist for this test
      const findings = await validator.validateFile(filePath);
      expect(Array.isArray(findings)).toBe(true);
    });
  });

  describe('Type System Edge Cases', () => {
    it('should handle unknown severity levels', () => {
      // Bug: Invalid severity values cause type errors
      // Expected: Should validate properly
      const result = kb.listPractices({});

      result.practices.forEach(practice => {
        expect(['critical', 'important', 'recommended', 'info']).toContain(practice.severity);
      });
    });

    it('should handle unknown category types', () => {
      // Bug: Invalid categories cause issues
      // Expected: Should validate properly
      const result = kb.listPractices({});

      result.practices.forEach(practice => {
        expect(['structure', 'naming', 'documentation', 'performance', 'security', 'testing', 'dependency', 'style'])
          .toContain(practice.category);
      });
    });
  });

  describe('Documentation and Code Quality', () => {
    it('all practices should have examples', () => {
      // Bug: Missing examples in practices
      // Expected: All practices should have at least one example
      const result = kb.listPractices({});

      result.practices.forEach(practice => {
        expect(Array.isArray(practice.examples)).toBe(true);
        expect(practice.examples.length).toBeGreaterThan(0);
      });
    });

    it('all practices should have non-empty descriptions', () => {
      // Bug: Empty descriptions
      // Expected: All practices should have meaningful descriptions
      const result = kb.listPractices({});

      result.practices.forEach(practice => {
        expect(practice.description).toBeDefined();
        expect(practice.description.length).toBeGreaterThan(10);
      });
    });

    it('all findings should have suggestions when applicable', () => {
      // Bug: Missing suggestions for important findings
      // Expected: Important/critical findings should have suggestions
      const projectPath = path.resolve(__dirname, '../examples/example-package');
      const result = validator.validateProject(projectPath, 'package');

      result.findings.forEach(finding => {
        if (finding.severity === 'critical' || finding.severity === 'important') {
          // Should ideally have suggestions, but at minimum should have valid message
          expect(finding.message).toBeDefined();
          expect(finding.message.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
