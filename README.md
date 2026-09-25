# R Best Practices MCP Server

An **MCP (Model Context Protocol) server** that enforces best practices across all standard R development workflows. Provides workflow detection, project validation, and template generation for R scripts, Quarto documents, Shiny applications, R packages, and more.

## Overview

The R Best Practices MCP Server helps developers write better R code by:

- **Detecting** the R workflow type from a directory structure
- **Validating** projects against best practices with detailed findings
- **Generating** scaffold templates for new projects
- **Providing** knowledge base access to 52+ best practices and recommendations

### Supported Workflows

| Workflow | Description |
|----------|-------------|
| **r-script** | Standalone R scripts for data processing and analysis |
| **quarto** | Quarto documents for reproducible analysis and reporting |
| **shiny** | Interactive web applications using Shiny |
| **package** | R packages for code organization and distribution |
| **rmarkdown** | R Markdown documents for dynamic reports |
| **renv** | Projects using renv for dependency management |
| **targets** | Pipeline projects using the targets framework |
| **plumber** | REST APIs built with Plumber |
| **analysis** | Data analysis projects with standard directory structure |

## Features

### 🔍 Workflow Detection
Automatically detects the R project type with confidence scoring:
- Analyzes file patterns and directory structure
- Identifies workflow-specific files (DESCRIPTION, app.R, _targets.R, etc.)
- Returns confidence percentage (0-100%)
- Includes indicators of detected workflow

### ✓ Project Validation
Comprehensive validation against best practices:
- **Severity levels**: critical, important, recommended, info
- **Categories**: structure, naming, documentation, performance, security, testing
- **Actionable suggestions** for every finding
- **File-level** and **project-level** validation

### 🎯 Template Generation
Generate complete project scaffolds:
- Realistic file structures for each workflow
- Sample code demonstrating best practices
- Configuration files (DESCRIPTION, .Rprofile, renv.lock, etc.)
- Markdown documentation and setup instructions
- Customizable project name and author info

### 📚 Knowledge Base
Access to 52 best practices:
- Organized by workflow type (9 workflows)
- Categorized by topic (documentation, testing, security, etc.)
- Searchable and filterable
- Includes examples and references

## Installation

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/alexseymer/r-best-practice-mcp.git
cd r-best-practice-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

## Usage

### As an MCP Server

The server exposes 6 tools via the Model Context Protocol:

#### 1. `detect_workflow` — Identify project type
```javascript
// Input
{ "path": "/path/to/project" }

// Output
{
  "workflow": "package",
  "confidence": 95,
  "indicators": ["DESCRIPTION", "R/", "tests/testthat/"]
}
```

#### 2. `validate_project` — Check best practices
```javascript
// Input
{ "path": "/path/to/project", "workflow": "package" }

// Output
{
  "workflow": "package",
  "findings": [
    {
      "id": "pkg-tests",
      "severity": "important",
      "category": "testing",
      "message": "Add tests/ directory with testthat tests"
    }
  ],
  "duration": 45
}
```

#### 3. `validate_file` — Check single file
```javascript
// Input
{ "path": "/path/to/file.R" }

// Output
{
  "path": "/path/to/file.R",
  "findings": [...]
}
```

#### 4. `generate_template` — Create scaffolds
```javascript
// Input
{
  "workflow": "shiny",
  "projectName": "my-dashboard",
  "authorName": "John Doe"
}

// Output
{
  "workflow": "shiny",
  "files": [
    { "path": "app.R", "content": "..." },
    { "path": "README.md", "content": "..." }
  ],
  "directories": [...]
}
```

#### 5. `get_practice` — Details about a practice
```javascript
// Input
{ "id": "pkg-roxygen" }

// Output
{
  "id": "pkg-roxygen",
  "title": "Use roxygen2 for documentation",
  "workflow": "package",
  "category": "documentation",
  "description": "...",
  "examples": [...]
}
```

#### 6. `list_practices` — Browse best practices
```javascript
// Input
{ "workflow": "package", "category": "documentation" }

// Output
{
  "practices": [...],
  "total": 52
}
```

## Project Structure

```
r-best-practice-mcp/
├── src/
│   ├── engine/
│   │   ├── detector.ts            # Workflow detection
│   │   ├── validator.ts           # Project validation
│   │   └── template-generator.ts  # Template generation
│   ├── data/
│   │   └── knowledge-base.ts      # 52 best practices
│   ├── types/
│   │   ├── workflow.ts            # Workflow types
│   │   ├── finding.ts             # Validation findings
│   │   ├── practice.ts            # Best practices
│   │   ├── template.ts            # Template structures
│   │   └── common.ts              # Common types
│   ├── utils/
│   │   ├── file.ts                # File system utilities
│   │   └── logger.ts              # Logging
│   ├── server.ts                  # MCP server
│   └── index.ts                   # Entry point
├── tests/
│   ├── unit/                      # Unit tests (91 tests)
│   └── fixtures/                  # Test fixtures
├── dist/                          # Compiled output
├── jest.config.js
├── tsconfig.json
├── package.json
└── README.md
```

## Development

### Scripts

```bash
# Build TypeScript
npm run build

# Run all tests with coverage
npm test

# Watch mode for development
npm run test:watch

# Run specific test suite
npm test -- detector.test.ts

# Linting
npm run lint

# Code formatting
npm run format
```

### Testing

Comprehensive test coverage (91 tests):
- ✓ Workflow detection for all 9 types
- ✓ Project validation across workflows
- ✓ Template generation and content
- ✓ Knowledge base functionality
- ✓ File system utilities

## Best Practices Coverage

The knowledge base includes 52+ best practices:

**R Scripts** (7) — Headers, functions, naming, organization  
**Quarto** (7) — Chunks, YAML, caching, figures, tables  
**Shiny** (7) — Reactivity, validation, modules, feedback  
**Packages** (9) — roxygen2, testing, DESCRIPTION, coverage  
**R Markdown** (4) — YAML, chunks, options, inline code  
**renv** (4) — Init, lock, snapshot, restore  
**targets** (4) — Structure, naming, dependencies, branching  
**Plumber** (6) — Endpoints, validation, responses, errors  
**Analysis** (3) — Directory structure, docs, versioning  

## Examples

### Validate an R Package

```bash
# Using the MCP server
mcp_tool_call "validate_project" '{"path": "/path/to/mypackage"}'

# Response includes:
# - Missing DESCRIPTION file (critical)
# - No tests/ directory (important)
# - Missing LICENSE (critical)
# - No README.md (recommended)
```

### Generate a Shiny Template

```bash
# Using the MCP server
mcp_tool_call "generate_template" '{
  "workflow": "shiny",
  "projectName": "my-app",
  "authorName": "Jane Doe"
}'

# Returns scaffold with:
# - app.R with UI/server structure
# - README.md with setup instructions
# - .gitignore configured
```

### Detect Project Type

```bash
# Using the MCP server
mcp_tool_call "detect_workflow" '{"path": "/path/to/project"}'

# Automatically identifies:
# - Workflow type with confidence
# - Detected indicators
# - Timestamp
```

## Performance

- **Detection**: ~50-100ms per project
- **Validation**: ~100-500ms depending on project size
- **Template Generation**: <10ms
- **Knowledge base queries**: <5ms

## Dependencies

### Runtime
- `@modelcontextprotocol/sdk` — MCP protocol

### Development
- `typescript` — Type safety
- `jest` — Testing framework
- `ts-jest` — TypeScript support
- `@types/jest` — Jest types
- `@types/node` — Node.js types

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## Roadmap

- [ ] CLI interface for local use
- [ ] VS Code extension
- [ ] Web dashboard
- [ ] Custom rules configuration
- [ ] Additional workflows (bookdown, blogdown)
- [ ] Performance profiling

## License

MIT License

## Support

- **Issues**: [GitHub Issues](https://github.com/alexseymer/r-best-practice-mcp/issues)
- **Questions**: [GitHub Discussions](https://github.com/alexseymer/r-best-practice-mcp/discussions)
