# r-coding-mcp

An MCP (Model Context Protocol) server for R package development. Enables Claude to interact with R packages, CRAN metadata, testing infrastructure, and release automation.

## Features

### 🎯 CRAN Integration
- Search packages on CRAN
- Get detailed package metadata and dependencies
- Check package dependencies against CRAN
- Validate version constraints

### 🧪 Testing & Quality Assurance
- Run `devtools::test()` with parsed results
- Run `devtools::check()` (R CMD check)
- Validate roxygen2 documentation
- Extract and summarize test failures

### 🚀 Release Automation
- Bump versions (major/minor/patch)
- Prepare packages for CRAN release
- Generate NEWS/CHANGELOG from git history
- Validate release readiness

## Installation

### Prerequisites
- Node.js 16+
- R 4.0+ with devtools, roxygen2, jsonlite
- Git

### Setup

```bash
git clone https://github.com/alexseymer/r-coding-mcp.git
cd r-coding-mcp
npm install
npm run build
```

## Usage

### As an MCP Server

Start the server:
```bash
npm start
```

The server communicates via stdio with Claude. Configure it in your MCP client (e.g., Claude's `cline_mcp_servers.json`).

### Available Tools

#### CRAN Tools
- **cran_search** — Search CRAN packages
- **cran_package_info** — Get package metadata
- **cran_check_dependencies** — Validate dependencies

#### Testing Tools
- **devtools_test** — Run package tests
- **devtools_check** — Run R CMD check
- **roxygen_validate** — Validate documentation

#### Release Tools
- **bump_version** — Increment version number
- **prepare_release** — Prepare for CRAN submission
- **generate_news** — Create changelog from git

### Example: Check Package Dependencies

```bash
npm start
# In Claude or MCP client:
# Tool: cran_check_dependencies
# Arguments: { "description_path": "/path/to/DESCRIPTION" }
```

## Project Structure

```
src/
  ├── index.ts           # MCP server entry point
  ├── modules/
  │   ├── cran.ts        # CRAN integration module
  │   ├── testing.ts     # Testing & QA module
  │   └── release.ts     # Release automation module
  └── utils/             # Utility functions (future)
```

## Development

```bash
# Watch TypeScript compilation
npm run watch

# Run linter
npm run lint

# Format code
npm run format

# Run tests (when available)
npm test
```

## Roadmap

- [ ] **v0.2.0** — Add lintr integration for static analysis
- [ ] **v0.2.0** — Coverage report generation
- [ ] **v0.3.0** — CRAN submission automation
- [ ] **v0.3.0** — S3/S4 method validation
- [ ] **v0.4.0** — Performance profiling tools
- [ ] **v0.4.0** — Dependency update checking
- [ ] **v1.0.0** — Full release workflow orchestration

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -am 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License — see [LICENSE](LICENSE) file

## Acknowledgments

- Built for the [r-coding ecosystem](https://github.com/alexseymer/onedevR)
- Based on [Model Context Protocol](https://modelcontextprotocol.io/)
- References: [devtools](https://devtools.r-lib.org/), [roxygen2](https://roxygen2.r-lib.org/), [testthat](https://testthat.r-lib.org/)

## Support

- Issues: [GitHub Issues](https://github.com/alexseymer/r-coding-mcp/issues)
- Discussions: [GitHub Discussions](https://github.com/alexseymer/r-coding-mcp/discussions)
