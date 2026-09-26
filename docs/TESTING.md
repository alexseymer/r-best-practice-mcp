# Testing Guide - R Best Practices MCP Server

Comprehensive guide for running and writing tests for the R Best Practices MCP Server project.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Test Suites](#test-suites)
5. [Writing Tests](#writing-tests)
6. [Coverage Requirements](#coverage-requirements)
7. [CI/CD Integration](#cicd-integration)
8. [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:load

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm test -- --coverage
```

## Test Structure

The test suite is organized into the following directories:

```
tests/
├── unit/                          # Unit tests for individual components
│   ├── detector.test.ts          # WorkflowDetector tests
│   ├── validator.test.ts         # Validator tests
│   ├── template-generator.test.ts # TemplateGenerator tests
│   ├── knowledge-base.test.ts    # KnowledgeBase tests
│   └── file-utils.test.ts        # FileUtils tests
├── integration/                   # Integration tests
│   └── api.test.ts               # API endpoint integration tests
├── e2e/                          # End-to-end tests
│   └── docker.test.ts            # Docker and docker-compose tests
├── performance/                   # Performance and load tests
│   └── load.test.ts              # Load testing and benchmarks
├── fixtures/                      # Test data and utilities
│   └── setup.ts                  # Fixture setup and helpers
├── examples.test.ts              # Example project validation tests
└── regression.test.ts            # Regression tests for reported issues
```

## Running Tests

### All Tests
```bash
npm test
```
Runs all tests with coverage reporting.

### Unit Tests Only
```bash
npm run test:unit
```
Runs only the unit tests in `tests/unit/` directory.

### Integration Tests
```bash
npm run test:integration
```
Runs API integration tests. Requires the application to build successfully.

### End-to-End Tests
```bash
npm run test:e2e
```
Runs Docker and docker-compose tests. Requires Docker to be installed and running.

### Performance/Load Tests
```bash
npm run test:load
```
Runs load and stress tests. Measures performance metrics and throughput.

### Watch Mode
```bash
npm run test:watch
```
Runs tests in watch mode - re-runs tests when files change. Useful during development.

### Specific Test File
```bash
npm test -- detector.test.ts
```
Runs tests matching the pattern.

### With Verbose Output
```bash
npm test -- --verbose
```
Shows more detailed test output.

## Test Suites

### Unit Tests (`tests/unit/`)

Unit tests for individual components:

#### Detector Tests (`detector.test.ts`)
- Tests workflow detection accuracy
- Tests confidence scoring
- Tests edge cases (empty directories, unknown workflows)
- Tests all 9 supported workflows
- Coverage: ~90%

**Key test cases:**
- Detects package projects
- Detects Shiny apps
- Detects R scripts
- Detects Quarto documents
- Handles unknown workflows
- Scores confidence correctly

#### Validator Tests (`validator.test.ts`)
- Tests validation rules for each workflow
- Tests file-level validation
- Tests severity assignment
- Tests category organization
- Coverage: ~85%

**Key test cases:**
- Validates package structure
- Validates R file quality
- Returns correct severity levels
- Filters findings by severity
- Handles missing files

#### Template Generator Tests (`template-generator.test.ts`)
- Tests template generation for all workflows
- Tests file and directory creation
- Tests metadata inclusion
- Coverage: ~90%

**Key test cases:**
- Generates package templates
- Generates Shiny templates
- Includes proper directory structure
- Includes example files
- Includes documentation

#### Knowledge Base Tests (`knowledge-base.test.ts`)
- Tests practice retrieval
- Tests practice filtering
- Tests knowledge base indexing
- Coverage: ~95%

**Key test cases:**
- Gets practice by ID
- Lists practices by workflow
- Lists practices by category
- Handles missing practices
- Returns complete practice data

#### File Utils Tests (`file-utils.test.ts`)
- Tests file system operations
- Tests directory traversal
- Tests pattern matching
- Coverage: ~85%

**Key test cases:**
- Reads file contents
- Lists files recursively
- Checks file existence
- Handles paths correctly

### Integration Tests (`tests/integration/`)

Integration tests for the web API:

#### API Tests (`api.test.ts`)
- Tests all 6 API endpoints
- Tests request/response format
- Tests error handling
- Tests HTTP status codes
- Coverage: ~80%

**Endpoints tested:**
1. `POST /api/detect-workflow` - Workflow detection
2. `POST /api/validate-project` - Project validation
3. `POST /api/validate-file` - File validation
4. `GET /api/practice/:id` - Get practice details
5. `GET /api/practices` - List practices
6. `POST /api/generate-template` - Template generation

**Test categories:**
- Successful requests with valid inputs
- Error handling with invalid inputs
- Missing parameters
- Non-existent resources
- Filtering and querying
- Response structure validation

**Example test:**
```typescript
it('should validate package project', async () => {
  const response = await fetch(`${baseUrl}/api/validate-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: examplePath }),
  });

  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.error).toBe(false);
  expect(data.data.findings).toBeDefined();
});
```

### End-to-End Tests (`tests/e2e/`)

End-to-end tests using Docker:

#### Docker Tests (`docker.test.ts`)
- Tests Docker image build
- Tests container startup
- Tests health checks
- Tests API through Docker
- Tests volume mounting
- Tests security (non-root user)

**Test categories:**
- Docker build verification
- Container execution
- Health check endpoints
- API functionality in container
- docker-compose orchestration
- Volume mounting and project validation
- Container security

**Note:** Docker tests use `.skip()` by default. To run them:
1. Ensure Docker is installed and running
2. Remove `.skip()` from test names or use environment variable

### Performance/Load Tests (`tests/performance/`)

Performance and load testing:

#### Load Tests (`load.test.ts`)
- Measures operation latency
- Tests concurrent operations (10, 50, 100+ concurrent)
- Measures throughput
- Tests large project handling
- Monitors memory usage
- Stress testing with 200+ operations

**Performance targets:**
- Detection: < 200ms (single), < 3s (50 concurrent)
- Validation: < 500ms (single), < 2s (5 concurrent)
- Template generation: < 50ms (single)
- Mixed operations: < 2s (20 concurrent)

**Example test:**
```typescript
it('should detect workflow in < 200ms', async () => {
  const { duration } = await measureTime(() => 
    detector.detect(projectPath)
  );
  expect(duration).toBeLessThan(200);
});
```

### Example Project Tests (`examples.test.ts`)

Validates all 5 example projects:

**Example projects:**
1. `example-package` - R package project
2. `example-shiny-app` - Shiny application
3. `example-r-script` - Simple R script
4. `example-quarto-doc` - Quarto document
5. `example-data-analysis` - Data analysis project

**Tests:**
- Correct workflow detection
- Successful validation
- Proper file structure
- Cross-project consistency
- File-level validation

### Regression Tests (`regression.test.ts`)

Tests for reported bugs and edge cases:

**Test categories:**
- Detection edge cases (empty dirs, special characters)
- Validation edge cases (BOM characters, long lines)
- Knowledge base edge cases (missing IDs, invalid filters)
- Concurrent operation edge cases
- File system edge cases (symlinks, permissions)
- Type system validation
- Code quality checks

**How to add regression tests:**
1. Create a test that reproduces the reported bug
2. Add a comment explaining the bug
3. Run the test to confirm it fails
4. Fix the bug in the source code
5. Verify the test passes
6. Keep the test to prevent regression

## Writing Tests

### Basic Unit Test Structure

```typescript
import { MyComponent } from '../src/my-component.js';

describe('MyComponent', () => {
  let component: MyComponent;

  beforeEach(() => {
    component = new MyComponent();
  });

  describe('specific functionality', () => {
    it('should do something', async () => {
      const result = await component.doSomething();
      expect(result).toBe(expectedValue);
    });

    it('should handle error case', async () => {
      expect(() => component.invalid()).toThrow();
    });
  });
});
```

### Best Practices

1. **Clear test names**: Use descriptive test names that explain what is being tested
   ```typescript
   // Good
   it('should detect package workflow with high confidence', async () => {
   
   // Bad
   it('detects workflow', async () => {
   ```

2. **Arrange-Act-Assert pattern**:
   ```typescript
   it('should validate package', async () => {
     // Arrange
     const projectPath = '/path/to/package';
     
     // Act
     const result = await validator.validateProject(projectPath, 'package');
     
     // Assert
     expect(result.findings).toBeDefined();
   });
   ```

3. **Use fixtures for test data**:
   ```typescript
   import { createTestProject } from '../fixtures/setup.js';
   
   it('should validate test project', async () => {
     const project = createTestProject('package');
     const result = await validator.validateProject(project.path);
     expect(result.findings).toBeDefined();
   });
   ```

4. **Test error cases**:
   ```typescript
   it('should return error for non-existent file', async () => {
     const result = await validator.validateFile('/non/existent/file.R');
     expect(result).toHaveProperty('error', true);
   });
   ```

5. **Use meaningful assertions**:
   ```typescript
   // Good
   expect(result.workflow).toBe('package');
   expect(result.confidence).toBeGreaterThan(70);
   
   // Bad
   expect(result).toBeTruthy();
   ```

## Coverage Requirements

The project maintains the following coverage thresholds:

```
Statements:  70%
Branches:    70%
Functions:   70%
Lines:       70%
```

### Generate Coverage Report

```bash
npm test -- --coverage
```

This generates a coverage report in the `coverage/` directory.

### View HTML Coverage Report

```bash
# Generate coverage
npm test -- --coverage

# Open in browser
open coverage/lcov-report/index.html
```

## CI/CD Integration

### GitHub Actions

The project can be integrated with GitHub Actions for automated testing:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Run load tests
        run: npm run test:load
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hook

To run tests before committing:

```bash
# In .git/hooks/pre-commit
#!/bin/bash
npm run test:unit
if [ $? -ne 0 ]; then
  echo "Unit tests failed"
  exit 1
fi
```

## Troubleshooting

### Tests Timeout

**Problem:** Tests timeout with error like "Jest did not exit one second after the test run has completed"

**Solutions:**
1. Increase timeout: `jest.setTimeout(10000);`
2. Ensure all promises are resolved
3. Check for unfinished async operations
4. Use `afterAll()` to clean up resources

### Module Not Found

**Problem:** "Cannot find module" errors

**Solutions:**
1. Run `npm run build` to compile TypeScript
2. Check imports use `.js` extension (ESM)
3. Verify `tsconfig.json` settings
4. Clear Jest cache: `jest --clearCache`

### Port Already in Use

**Problem:** "Port 3000 already in use" in integration tests

**Solutions:**
1. Kill process using the port
2. Use different port in test config
3. Ensure cleanup in `afterAll()` blocks

### Docker Tests Failing

**Problem:** Docker tests skip or fail

**Solutions:**
1. Ensure Docker is installed: `docker --version`
2. Build image first: `docker build -t r-practices-test:latest .`
3. Check Docker daemon is running
4. Remove `.skip()` from Docker tests

### Memory Issues

**Problem:** "Out of memory" during load tests

**Solutions:**
1. Reduce concurrency in load tests
2. Run fewer operations per test
3. Add garbage collection: `--expose-gc`
4. Check for memory leaks in event listeners

### Flaky Tests

**Problem:** Tests pass sometimes, fail other times

**Solutions:**
1. Add explicit waits: `await new Promise(resolve => setTimeout(resolve, 100))`
2. Increase timeouts
3. Mock external dependencies
4. Use `beforeEach()` for clean state

## Performance Benchmarks

Current performance benchmarks (on standard hardware):

| Operation | Time | Throughput |
|-----------|------|-----------|
| Detect workflow | 50-100ms | 10-20 ops/sec |
| Validate project | 100-300ms | 3-10 ops/sec |
| Validate file | 10-50ms | 20-100 ops/sec |
| Generate template | 5-20ms | 50-200 ops/sec |
| Knowledge base query | <5ms | 200+ ops/sec |

## Continuous Improvement

- Monitor test execution time
- Update performance targets as needed
- Review and refactor slow tests
- Add tests for newly reported issues
- Keep test coverage above 70%
- Document complex test scenarios
