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

### Via MCP Server (Claude & other clients)

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
│   │   ├── detector.ts            # Workflow detection (208 lines)
│   │   ├── validator.ts           # Project validation (503 lines)
│   │   └── template-generator.ts  # Template generation (833 lines)
│   ├── data/
│   │   └── knowledge-base.ts      # 52 best practices (592 lines)
│   ├── analysis/                  # Phase 6: Advanced features
│   │   ├── complexity.ts          # Complexity analysis
│   │   ├── dependencies.ts        # Dependency tracking
│   │   ├── performance.ts         # Performance profiling
│   │   ├── auto-fixes.ts          # Automated fixes
│   │   └── index.ts               # Exports
│   ├── cli/                       # Phase 4: CLI interface
│   │   ├── index.ts               # Command setup
│   │   └── commands/
│   │       ├── detect.ts          # Detect workflow
│   │       ├── validate.ts        # Validate project
│   │       ├── template.ts        # Generate template
│   │       └── report.ts          # Generate report
│   ├── config/
│   │   └── rules-engine.ts        # Custom validation rules
│   ├── types/
│   │   ├── workflow.ts, finding.ts, practice.ts, etc.
│   ├── utils/
│   │   ├── file.ts, logger.ts
│   ├── server.ts                  # MCP server (358 lines)
│   └── index.ts
├── vscode-extension/              # Phase 5: VS Code integration
│   ├── package.json
│   ├── src/
│   │   ├── extension.ts           # Main extension
│   │   ├── client.ts              # MCP communication
│   │   ├── diagnostics.ts         # VS Code diagnostics
│   │   └── commands.ts            # Command handlers
├── rstudio-addin/                 # Phase 7: RStudio integration
│   ├── DESCRIPTION, NAMESPACE
│   ├── R/
│   │   ├── addins.R               # 4 addin functions (337 lines)
│   │   └── utils.R                # MCP utilities (300+ lines)
│   ├── inst/rstudio/
│   │   └── addins.dcf             # RStudio registration
│   └── tests/
├── tests/
│   ├── unit/                      # Unit tests (5 suites, 91 tests)
│   └── fixtures/
├── dist/, jest.config.js, tsconfig.json, package.json
└── README.md, CLAUDE.md, CONTRIBUTING.md
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

## Interfaces Available

### 🖥️ MCP Server
The core MCP server exposing 6 tools for Claude and other MCP clients. Start with `node dist/index.js`.

### 💻 CLI Tool (Phase 4)
Local command-line tool for developers:
- `detect` — Identify project workflow type
- `validate` — Check projects against best practices
- `template` — Generate project scaffolds
- `report` — Create HTML validation reports
- `--watch` mode for continuous monitoring

### 📌 VS Code Extension (Phase 5)
Real-time validation within VS Code:
- Inline diagnostics with severity coloring
- Quick fix suggestions
- Workflow detection
- HTML report generation in WebView
- Keyboard shortcut: Shift+Alt+V

### 🎨 RStudio Addin (Phase 7)
In-IDE validation for RStudio:
- Validate Project gadget with findings table
- Detect Workflow dialog
- Generate Template interactive UI
- Show Report with statistics
- Access via RStudio Addins menu

## Advanced Features (Phase 6)

- **Complexity Analysis** — Cyclomatic complexity, nesting depth, LOC metrics
- **Dependency Tracking** — renv.lock, DESCRIPTION, library() analysis
- **Performance Profiling** — Operation timing and optimization suggestions
- **Automated Fixes** — roxygen2, imports, formatting, style fixes
- **Custom Rules** — Pattern-based validation rules

## Roadmap (Future Phases)

- [ ] Publish VS Code extension to marketplace
- [ ] Publish CLI tool to npm registry
- [ ] Publish RStudio addin to CRAN
- [ ] Web dashboard
- [ ] Additional workflows (bookdown, blogdown)
- [ ] Community rule library

## License

MIT License

## Support

- **Issues**: [GitHub Issues](https://github.com/alexseymer/r-best-practice-mcp/issues)
- **Questions**: [GitHub Discussions](https://github.com/alexseymer/r-best-practice-mcp/discussions)
