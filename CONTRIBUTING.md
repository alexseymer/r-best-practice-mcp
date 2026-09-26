# Contributing to R Best Practices MCP Server

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Be respectful and constructive in all interactions. We welcome contributors from all backgrounds and experience levels.

## Getting Started

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- Git
- Familiarity with TypeScript and Jest

### Setup for Development

```bash
# Fork and clone the repository
git clone https://github.com/YOUR-USERNAME/r-best-practice-mcp.git
cd r-best-practice-mcp

# Install dependencies
npm install

# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes, test, and commit
npm test
npm run build
```

## Making Changes

### Code Style

- **Use TypeScript strict mode** — All code must pass `npm run build`
- **Follow naming conventions** — Use camelCase for variables/functions, PascalCase for types/classes
- **Keep functions focused** — One responsibility per function
- **Use async/await** — Prefer async/await over Promise.then()
- **Add comments only for non-obvious logic** — Code should be self-documenting

### Project Structure

New features should follow the existing structure:
- **Engine components** go in `src/engine/`
- **Data/knowledge** goes in `src/data/`
- **Types** go in `src/types/`
- **Utilities** go in `src/utils/`
- **Tests** go in `tests/unit/`

### Adding Features

#### Adding a Best Practice

Edit `src/data/knowledge-base.ts` and add to the practices array:

```typescript
{
  id: 'unique-practice-id',
  title: 'Practice Title',
  workflow: 'package',  // or other workflow
  category: 'documentation',  // structure, naming, testing, etc.
  severity: 'important',  // critical, important, recommended, info
  description: 'Detailed explanation of why this practice matters.',
  examples: [
    '// Good example',
    '# Bad example'
  ],
  tags: ['optional', 'tags']
}
```

Then add a corresponding test in `tests/unit/knowledge-base.test.ts`.

#### Adding a Workflow Validator

In `src/engine/validator.ts`:

1. Add a new case in the `validateProject()` switch statement
2. Implement a `validateNewWorkflow()` method
3. Add comprehensive tests in `tests/unit/validator.test.ts`

```typescript
case 'new-workflow':
  findings.push(...(await this.validateNewWorkflow(dirPath)));
  break;

private async validateNewWorkflow(dirPath: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  // Implementation here
  return findings;
}
```

#### Adding a Template Generator

In `src/engine/template-generator.ts`:

1. Add a new case in the `generate()` method
2. Implement a `generateNewWorkflow()` method
3. Add tests in `tests/unit/template-generator.test.ts`

#### Adding an MCP Tool

In `src/server.ts`:

1. Add tool definition to `handleListTools()`
2. Add case in `handleCallTool()` switch statement
3. Implement handler method
4. Document in README.md

## Testing

### Writing Tests

All new code must include tests:

```bash
npm test                          # Run all tests
npm run test:watch                # Watch mode
npm test -- specific.test.ts      # Run specific file
```

### Test Guidelines

- **Name tests clearly** — `should validate R package structure`
- **Test happy path** — Normal case with valid input
- **Test error cases** — Missing files, invalid input, edge cases
- **Use fixtures** — Leverage `tests/fixtures/setup.ts` for test data
- **Aim for 90%+ coverage** — Run `npm test` to see coverage report

### Coverage Thresholds

Current requirements:
- **Statements**: 70%
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%

New code should aim for 90%+ coverage.

## Commit Messages

Follow this format:

```
[TYPE] Brief description (max 50 chars)

Longer explanation if needed. Wrap at 72 characters.
Explain the problem this commit solves.

- Bullet points for key changes
- Added: new files/functions
- Modified: existing components
- Removed: deleted code

Fixes #123
Related to #456
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **test**: Test additions/modifications
- **refactor**: Code restructuring without behavior changes
- **perf**: Performance improvements
- **chore**: Build, dependencies, tooling

### Examples

```
feat: Add validation for R Markdown files

- Implement validateRmdFile() method
- Check for YAML header presence
- Add 4 test cases

test: Add 10 new tests for template generator

docs: Update README with template examples

fix: Correct detection confidence scoring for packages
```

## Submitting Changes

### Before Submitting

1. **Run tests** — `npm test` (must pass)
2. **Check build** — `npm run build` (no errors)
3. **Lint code** — Code should follow style guidelines
4. **Update documentation** — Add/update docstrings and README

### Pull Request Process

1. **Create feature branch** from `claude/development-assistance-e1oir2`
2. **Make focused commits** — One feature per commit when possible
3. **Push to your fork** — `git push origin feature/your-feature`
4. **Open Pull Request** — Include:
   - Clear title describing the change
   - Description of what and why
   - Reference related issues (#123)
   - Summary of testing done

### PR Template

```markdown
## What
Brief description of changes.

## Why
Motivation and context for the change.

## How
Approach and implementation details.

## Testing
How was this tested? Include test case examples.

## Checklist
- [ ] Tests added/updated
- [ ] Tests pass with good coverage
- [ ] Code builds without errors
- [ ] Documentation updated
- [ ] Follows code style guidelines
- [ ] Commits have clear messages
```

## Review Process

- At least one maintainer review required
- Automated tests must pass
- Code coverage must meet thresholds
- Constructive feedback will be provided
- Discussions encouraged for design decisions

## Common Contributions

### Bug Reports

Report bugs with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (Node version, OS, etc.)
- Relevant error messages

### Feature Requests

Describe features with:
- Use case and motivation
- Proposed solution (if any)
- Alternatives considered
- Examples or mockups

### Documentation

Improvements to README.md, CLAUDE.md, or docstrings are always welcome!

## Development Tips

### Debugging

```bash
# Set DEBUG environment variable
DEBUG=* npm test

# Use node debugger
node --inspect-brk dist/index.js

# Check logs
npm run build && node dist/index.js 2>&1 | grep ERROR
```

### Performance Profiling

```bash
# Time a test
time npm test -- specific.test.ts

# Memory usage
node --expose-gc node_modules/.bin/jest --forceExit
```

## Questions?

- **Documentation**: Check CLAUDE.md for architecture details
- **Code examples**: Look at existing tests and implementations
- **GitHub Issues**: Search for related discussions
- **Discussions**: Start a GitHub Discussion for questions
- **GitHub Setup**: See [GITHUB_SETUP.md](./GITHUB_SETUP.md) for branch protection and CI/CD details

## Project Structure Reference

```
Phase 1: Workflow Detection ✅
  - WorkflowDetector class
  - 9 workflow type detection
  - Confidence scoring

Phase 2: Validator Engine ✅
  - Validator class
  - 9 workflow validators
  - File-level validation
  - 52 best practices

Phase 3: Template Generator ✅
  - TemplateGenerator class
  - 9 workflow templates
  - Customizable options

Phase 4: CLI Interface (planned)
  - Local command-line tool
  - File watching
  - Report generation

Phase 5: IDE Integration (planned)
  - VS Code extension
  - RStudio addin
```

## Recognition

Contributors are recognized in:
- Git commit history
- GitHub contributors page
- Project release notes

Thank you for contributing to improve R development practices! 🎉
