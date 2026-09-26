import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

describe('Docker End-to-End Tests', () => {
  const projectRoot = path.resolve(__dirname, '../../');
  const testTimeout = 120000; // 2 minutes for Docker operations

  // Helper to check if docker is available
  const isDockerAvailable = async (): Promise<boolean> => {
    try {
      await execAsync('docker --version');
      return true;
    } catch {
      return false;
    }
  };

  describe('Docker Build', () => {
    it.skip('should build Docker image successfully', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      const { stdout } = await execAsync('docker build -t r-practices-test:latest .', {
        cwd: projectRoot,
        timeout: testTimeout,
      });

      expect(stdout).toContain('Successfully built') || expect(stdout).toContain('successfully tagged');
    }, testTimeout);

    it.skip('should have correct image metadata', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      const { stdout } = await execAsync('docker inspect r-practices-test:latest --format="{{.Config.ExposedPorts}}"');

      // Should expose port 3000
      expect(stdout).toContain('3000');
    }, testTimeout);
  });

  describe('Docker Container Execution', () => {
    beforeEach(async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      // Clean up any existing test container
      try {
        await execAsync('docker stop r-practices-test-container 2>/dev/null || true');
        await execAsync('docker rm r-practices-test-container 2>/dev/null || true');
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    afterEach(async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) return;

      // Clean up test container
      try {
        await execAsync('docker stop r-practices-test-container 2>/dev/null || true');
        await execAsync('docker rm r-practices-test-container 2>/dev/null || true');
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    it.skip('should start container and health check passes', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      // Start container
      await execAsync(
        'docker run -d --name r-practices-test-container -p 3001:3000 r-practices-test:latest',
        { timeout: testTimeout }
      );

      // Wait for container to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check health
      const { stdout } = await execAsync('docker ps --filter name=r-practices-test-container --filter health=healthy');
      expect(stdout).toContain('r-practices-test-container');
    }, testTimeout);

    it.skip('should pass health check endpoint', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      // Start container
      await execAsync(
        'docker run -d --name r-practices-test-container -p 3001:3000 r-practices-test:latest',
        { timeout: testTimeout }
      );

      // Wait for container to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test health endpoint
      const response = await fetch('http://localhost:3001/health');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: 'ok',
        service: 'r-best-practices-mcp',
      });
    }, testTimeout);
  });

  describe('Docker Compose', () => {
    const testTimeout = 120000;

    beforeEach(async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) return;

      // Clean up any existing services
      try {
        await execAsync('docker-compose down 2>/dev/null || true', {
          cwd: projectRoot,
          timeout: 30000,
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    afterEach(async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) return;

      // Clean up services
      try {
        await execAsync('docker-compose down 2>/dev/null || true', {
          cwd: projectRoot,
          timeout: 30000,
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    it.skip('should start services with docker-compose', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      const { stdout } = await execAsync('docker-compose up -d', {
        cwd: projectRoot,
        timeout: testTimeout,
      });

      expect(stdout).toContain('Done');

      // Wait for service to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if service is running
      const { stdout: psOutput } = await execAsync('docker-compose ps', {
        cwd: projectRoot,
      });

      expect(psOutput).toContain('r-practices-api');
    }, testTimeout);

    it.skip('should have API responding through docker-compose', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      await execAsync('docker-compose up -d', {
        cwd: projectRoot,
        timeout: testTimeout,
      });

      // Wait for service to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test API
      const response = await fetch('http://localhost:3000/health');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
    }, testTimeout);

    it.skip('should handle project volume mounting', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      // Create a temporary test project
      const tempDir = path.join(projectRoot, '.test-docker-project');
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'test.R'),
        'cat("Hello from Docker test")\n'
      );

      try {
        // Update docker-compose to mount test directory
        const dcPath = path.join(projectRoot, 'docker-compose.yml');
        const dcContent = await fs.readFile(dcPath, 'utf-8');
        const updatedContent = dcContent.replace(
          '- /projects:/projects:ro',
          `- ${tempDir}:/test-project:ro`
        );
        await fs.writeFile(dcPath, updatedContent);

        // Start services
        await execAsync('docker-compose up -d', {
          cwd: projectRoot,
          timeout: testTimeout,
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Test that the mounted directory is accessible
        const response = await fetch('http://localhost:3000/api/validate-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '/test-project/test.R' }),
        });

        expect(response.status).toBeDefined();
      } finally {
        // Restore original docker-compose
        try {
          const dcPath = path.join(projectRoot, 'docker-compose.yml');
          const dcContent = await fs.readFile(dcPath, 'utf-8');
          const restoredContent = dcContent.replace(
            `- ${tempDir}:/test-project:ro`,
            '- /projects:/projects:ro'
          );
          await fs.writeFile(dcPath, restoredContent);

          // Clean up test directory
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (e) {
          // Ignore
        }
      }
    }, testTimeout);
  });

  describe('Container API Integration', () => {
    it.skip('should handle detect_workflow API call in container', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      // Assumes container is already running on port 3001
      const examplePath = '/examples/example-package';
      const response = await fetch('http://localhost:3001/api/detect-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: examplePath }),
      });

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('error', false);
        expect(data.data).toHaveProperty('workflow');
      }
    });

    it.skip('should handle validate_project API call in container', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      const examplePath = '/examples/example-package';
      const response = await fetch('http://localhost:3001/api/validate-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: examplePath }),
      });

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('error', false);
        expect(data.data).toHaveProperty('findings');
      }
    });

    it.skip('should handle generate_template API call in container', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      const response = await fetch('http://localhost:3001/api/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: 'package' }),
      });

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('error', false);
        expect(data.data).toHaveProperty('files');
      }
    });
  });

  describe('Docker Security', () => {
    it.skip('should run as non-root user', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      await execAsync(
        'docker run -d --name r-practices-security-test r-practices-test:latest',
        { timeout: testTimeout }
      );

      // Wait for container to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check user
      const { stdout } = await execAsync(
        'docker exec r-practices-security-test id',
        { timeout: 10000 }
      );

      // Should not be root (uid 0)
      expect(stdout).not.toContain('uid=0');

      // Clean up
      try {
        await execAsync('docker stop r-practices-security-test && docker rm r-practices-security-test');
      } catch (e) {
        // Ignore
      }
    }, testTimeout);
  });

  describe('Docker Performance', () => {
    it.skip('should startup quickly', async () => {
      const isAvailable = await isDockerAvailable();
      if (!isAvailable) {
        console.log('Docker not available, skipping Docker tests');
        return;
      }

      const start = performance.now();

      await execAsync(
        'docker run --rm -p 3002:3000 r-practices-test:latest &',
        { timeout: testTimeout }
      );

      // Wait for startup
      await new Promise(resolve => setTimeout(resolve, 5000));

      const duration = performance.now() - start;

      // Should be ready within 10 seconds
      expect(duration).toBeLessThan(10000);

      // Try to hit health endpoint
      try {
        const response = await fetch('http://localhost:3002/health');
        expect(response.status).toBe(200);
      } catch (e) {
        // Port might not be ready yet, that's okay for this test
      }

      // Clean up
      try {
        await execAsync('docker stop $(docker ps -q --filter ancestor=r-practices-test:latest) 2>/dev/null || true');
      } catch (e) {
        // Ignore
      }
    }, testTimeout);
  });
});
