# R Best Practices MCP Server - Project Summary

## What is This?

An **MCP (Model Context Protocol) server** that helps R developers follow best practices across any R project type. Integrates with Claude to provide intelligent code analysis and guidance.

## Core Capabilities

1. **Workflow Detection** - Automatically identifies R project type (script, package, Shiny, Quarto, etc.)
2. **Project Validation** - Checks projects against 66+ best practices with severity levels
3. **Template Generation** - Scaffolds new projects with proper structure
4. **Knowledge Base** - Access comprehensive practice documentation

## Quick Start

### As MCP Server
```bash
npm install
npm run build
node dist/index.js
```

### As Web Dashboard
```bash
npm run build
npm run start:web  # Runs on http://localhost:3000
```

### As CLI Tool
```bash
npm install -g r-best-practices-mcp
r-practices detect ./my-project
r-practices validate ./my-project
r-practices template --workflow package --output ./new-pkg
```

## Key Statistics

- **9 Workflows Supported**: r-script, quarto, shiny, package, rmarkdown, renv, targets, plumber, analysis
- **66+ Best Practices**: Categorized by severity (critical, important, recommended, info)
- **279 Unit Tests**: 90%+ coverage of core functionality
- **100% TypeScript**: Full type safety with strict mode

## Project Structure

```
├── src/
│   ├── engine/           # Core detection, validation, template logic
│   ├── cli/              # Command-line interface
│   ├── data/             # Knowledge base with 66+ practices
│   ├── utils/            # Shared utilities (file ops, logging, etc.)
│   └── web-server.ts     # Express web dashboard
├── tests/
│   ├── unit/             # Component tests
│   ├── integration/      # API integration tests
│   ├── e2e/              # End-to-end docker tests
│   └── performance/      # Performance benchmarks
└── examples/             # Sample projects for testing
```

## Development Workflow

1. **Make changes** to TypeScript files in `src/`
2. **Run tests** - `npm test` (should pass with high coverage)
3. **Build** - `npm run build` (compiles to JavaScript)
4. **Commit** - Create clear commit messages
5. **Push** - Push to development branch for review

## Key Dependencies

- **Express.js** - Web server framework
- **TypeScript** - Language with type safety
- **Jest** - Testing framework
- **ts-jest** - TypeScript support in Jest

## Build Status

✅ All tests passing (279/279 unit tests)
✅ Docker containerization ready
✅ npm package published
✅ Web dashboard deployed

## Next Steps

- [ ] Phase 5: IDE Integration (VS Code extension, RStudio addin)
- [ ] Custom rule creation and configuration
- [ ] Advanced metrics and code quality scores
- [ ] CI/CD integration examples

## For More Details

- See [README.md](README.md) for comprehensive documentation
- See [CLAUDE.md](CLAUDE.md) for architecture and design decisions
- See [package.json](package.json) for dependencies and scripts

---

**Built with** TypeScript | Jest | Express.js | MCP Protocol
