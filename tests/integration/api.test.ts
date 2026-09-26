import { RPracticesWebServer } from '../../src/web-server';
import path from 'path';

describe('API Integration Tests', () => {
  let server: RPracticesWebServer;
  let baseUrl: string;
  const port = 3001; // Use different port for tests

  beforeAll(async () => {
    server = new RPracticesWebServer(port);
    baseUrl = `http://localhost:${port}`;

    // Start server
    await server.start();

    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    // Server will be cleaned up by Jest
    process.exit(0);
  });

  describe('Health Check Endpoint', () => {
    it('should return health status', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        status: 'ok',
        service: 'r-best-practices-mcp',
        version: '1.0.0',
      });
    });
  });

  describe('Tools Endpoint', () => {
    it('should list all available tools', async () => {
      const response = await fetch(`${baseUrl}/api/tools`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toHaveLength(6);

      const toolNames = data.data.map((tool: any) => tool.name);
      expect(toolNames).toContain('detect_workflow');
      expect(toolNames).toContain('validate_project');
      expect(toolNames).toContain('validate_file');
      expect(toolNames).toContain('get_practice');
      expect(toolNames).toContain('list_practices');
      expect(toolNames).toContain('generate_template');
    });
  });

  describe('Detect Workflow Endpoint', () => {
    it('should detect package workflow', async () => {
      const examplePath = path.resolve(process.cwd(), 'examples/example-package');
      const response = await fetch(`${baseUrl}/api/detect-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: examplePath }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);
      expect(data.data.workflow).toBe('package');
      expect(data.data.confidence).toBeGreaterThan(0);
    });

    it('should detect shiny workflow', async () => {
      const examplePath = path.resolve(__dirname, '../../examples/example-shiny-app');
      const response = await fetch(`${baseUrl}/api/detect-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: examplePath }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);
      expect(data.data.workflow).toBe('shiny');
      expect(data.data.confidence).toBeGreaterThan(0);
    });

    it('should detect r-script workflow', async () => {
      const examplePath = path.resolve(__dirname, '../../examples/example-r-script');
      const response = await fetch(`${baseUrl}/api/detect-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: examplePath }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);
      expect(data.data.workflow).toBe('r-script');
      expect(data.data.confidence).toBeGreaterThan(0);
    });

    it('should return error for missing path parameter', async () => {
      const response = await fetch(`${baseUrl}/api/detect-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.code).toBe('MISSING_PARAMETER');
    });
  });

  describe('Validate Project Endpoint', () => {
    it('should validate package project', async () => {
      const examplePath = path.resolve(process.cwd(), 'examples/example-package');
      const response = await fetch(`${baseUrl}/api/validate-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: examplePath }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);
      expect(data.data).toHaveProperty('workflow');
      expect(data.data).toHaveProperty('findings');
      expect(Array.isArray(data.data.findings)).toBe(true);
    });

    it('should validate with explicit workflow type', async () => {
      const examplePath = path.resolve(process.cwd(), 'examples/example-package');
      const response = await fetch(`${baseUrl}/api/validate-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: examplePath, workflow: 'package' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);
      expect(data.data.workflow).toBe('package');
    });

    it('should return error for non-existent directory', async () => {
      const response = await fetch(`${baseUrl}/api/validate-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/non/existent/path' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.code).toBe('PATH_NOT_FOUND');
    });

    it('should return error for missing path parameter', async () => {
      const response = await fetch(`${baseUrl}/api/validate-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.code).toBe('MISSING_PARAMETER');
    });
  });

  describe('Validate File Endpoint', () => {
    it('should validate R file', async () => {
      const filePath = path.resolve(__dirname, '../../examples/example-package/R/statistics.R');
      const response = await fetch(`${baseUrl}/api/validate-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);
      expect(data.data).toHaveProperty('path');
      expect(data.data).toHaveProperty('findings');
      expect(Array.isArray(data.data.findings)).toBe(true);
    });

    it('should return error for non-existent file', async () => {
      const response = await fetch(`${baseUrl}/api/validate-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/non/existent/file.R' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.code).toBe('FILE_NOT_FOUND');
    });

    it('should return error for missing path parameter', async () => {
      const response = await fetch(`${baseUrl}/api/validate-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.code).toBe('MISSING_PARAMETER');
    });
  });

  describe('Get Practice Endpoint', () => {
    it('should get a practice by ID', async () => {
      const response = await fetch(`${baseUrl}/api/practice/doc-function-comments`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);
      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('title');
      expect(data.data).toHaveProperty('workflow');
      expect(data.data).toHaveProperty('category');
      expect(data.data).toHaveProperty('description');
    });

    it('should return error for non-existent practice', async () => {
      const response = await fetch(`${baseUrl}/api/practice/non-existent-id`, {
        method: 'GET',
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.code).toBe('NOT_FOUND');
    });
  });

  describe('List Practices Endpoint', () => {
    it('should list all practices', async () => {
      const response = await fetch(`${baseUrl}/api/practices`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);
      expect(data.data).toHaveProperty('practices');
      expect(Array.isArray(data.data.practices)).toBe(true);
      expect(data.data.practices.length).toBeGreaterThan(0);
    });

    it('should filter practices by workflow', async () => {
      const response = await fetch(`${baseUrl}/api/practices?workflow=package`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);

      // All returned practices should be for package workflow
      data.data.practices.forEach((practice: any) => {
        expect(practice.workflow).toBe('package');
      });
    });

    it('should filter practices by category', async () => {
      const response = await fetch(`${baseUrl}/api/practices?category=documentation`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);

      // All returned practices should be in documentation category
      data.data.practices.forEach((practice: any) => {
        expect(practice.category).toBe('documentation');
      });
    });

    it('should filter by both workflow and category', async () => {
      const response = await fetch(`${baseUrl}/api/practices?workflow=package&category=documentation`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);

      // All returned practices should match both filters
      data.data.practices.forEach((practice: any) => {
        expect(practice.workflow).toBe('package');
        expect(practice.category).toBe('documentation');
      });
    });
  });

  describe('Generate Template Endpoint', () => {
    it('should generate package template', async () => {
      const response = await fetch(`${baseUrl}/api/generate-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: 'package' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);
      expect(data.data).toHaveProperty('files');
      expect(data.data).toHaveProperty('directories');
      expect(Array.isArray(data.data.files)).toBe(true);
      expect(Array.isArray(data.data.directories)).toBe(true);
    });

    it('should generate template with custom metadata', async () => {
      const response = await fetch(`${baseUrl}/api/generate-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: 'package',
          projectName: 'myproject',
          authorName: 'John Doe',
          authorEmail: 'john@example.com',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);
      expect(data.data).toHaveProperty('files');
      expect(data.data.files.length).toBeGreaterThan(0);
    });

    it('should generate shiny template', async () => {
      const response = await fetch(`${baseUrl}/api/generate-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: 'shiny' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBe(false);
      expect(data.data.files.length).toBeGreaterThan(0);
    });

    it('should return error for missing workflow parameter', async () => {
      const response = await fetch(`${baseUrl}/api/generate-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.code).toBe('MISSING_PARAMETER');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown route', async () => {
      const response = await fetch(`${baseUrl}/api/unknown-endpoint`);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.code).toBe('NOT_FOUND');
    });
  });
});
