# R Best Practices MCP Server

[![Build](https://github.com/alexseymer/r-coding-mcp/actions/workflows/build.yaml/badge.svg)](https://github.com/alexseymer/r-coding-mcp/actions/workflows/build.yaml)
[![Publish](https://github.com/alexseymer/r-coding-mcp/actions/workflows/publish.yml/badge.svg)](https://github.com/alexseymer/r-coding-mcp/actions/workflows/publish.yml)
[![npm](https://img.shields.io/npm/v/r-best-practices-mcp.svg)](https://www.npmjs.com/package/r-best-practices-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/alexseymer/r-best-practices-mcp.svg)](https://hub.docker.com/r/alexseymer/r-best-practices-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

An **MCP (Model Context Protocol) server** that enforces best practices across all standard R development workflows. Provides workflow detection, project validation, and template generation for R scripts, Quarto documents, Shiny applications, R packages, and more.

## Overview

The R Best Practices MCP Server helps developers write better R code by:

- **Detecting** the R workflow type from a directory structure
- **Validating** projects against best practices with detailed findings
- **Generating** scaffold templates for new projects
- **Providing** knowledge base access to 70 best practices (59 checked automatically, 11 guidance-only)

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
| **bookdown** | Books and theses created with bookdown |
| **blogdown** | Blogs and websites created with blogdown and Hugo |
| **shinytest** | Shiny apps with automated testing using shinytest |

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
Access to 70 best practices:
- Organized by workflow type (12 workflows)
- Categorized by topic (documentation, testing, security, etc.)
- Every practice has details, a "bad" and a "good" example, and references
- **Automated** practices are checked by a validator rule with the same id; **guidance** practices are advice only and never produce findings
- Searchable and filterable by workflow, category, minimum severity, tags, check type and free text

### 🔐 Security & Rate Limiting
Production-ready security features:
- **Path traversal protection** — Prevents directory traversal attacks
- **Input sanitization** — Removes shell metacharacters and validates paths
- **Rate limiting** — 100 requests per 60 seconds per IP address
- **Request size limits** — 50MB maximum request body
- **HTTPS/TLS support** — Full SSL configuration with reverse proxy
- See [SECURITY.md](./SECURITY.md) for comprehensive security documentation

### 📊 API Documentation & Versioning
Professional API standards:
- **OpenAPI 3.0 specification** — Access at `/openapi.json`
- **Swagger UI** — Interactive API explorer at `/api-docs`
- **Pagination support** — Offset-based pagination with metadata
- **Dual versioning** — `/api/` (v0 - backward compatible) and `/api/v1/` (current - recommended)
- **Enhanced rate limit headers** — `X-RateLimit-*` and `X-Pagination-*` headers
- See [API_VERSIONING.md](./API_VERSIONING.md) for migration guides

## Phase 3: Production Hardening (v0.3.0)

This release includes comprehensive security, standards compliance, and deployment improvements:

### Phase 3A: Security Hardening
- ✅ Path traversal protection with canonical path validation
- ✅ Input sanitization removing shell metacharacters
- ✅ In-memory rate limiting (100 req/60s per IP)
- ✅ Request body size limits (50MB default)
- ✅ Client IP extraction from proxy headers
- ✅ Comprehensive test coverage (30 tests, 100% coverage)

### Phase 3B: API Standards & Versioning
- ✅ OpenAPI 3.0 specification generation
- ✅ Swagger UI interactive documentation at `/api-docs`
- ✅ Offset-based pagination with metadata
- ✅ Dual versioning (v0 backward compatible, v1 current)
- ✅ Rate limit and pagination response headers
- ✅ 100+ total test cases (61 new tests for Phase 3)

### Phase 3C: Documentation
- ✅ [SECURITY.md](./SECURITY.md) — Comprehensive security best practices
- ✅ [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) — Production deployment guide
- ✅ [API_VERSIONING.md](./API_VERSIONING.md) — Versioning strategy and migration guides
- ✅ Updated README with new features and examples

## Installation

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### From npm Registry (Recommended)

```bash
# Install the published package
npm install r-best-practices-mcp

# Or install globally for CLI usage
npm install -g r-best-practices-mcp
```

### From Source

```bash
# Clone the repository
git clone https://github.com/alexseymer/r-coding-mcp.git
cd r-coding-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

### Docker Deployment

Run the server in a containerized environment with automatic dependency management:

#### Using Docker Hub (Recommended)

```bash
# Pull the latest image from Docker Hub
docker pull alexseymer/r-best-practices-mcp:latest

# Or use a specific version
docker pull alexseymer/r-best-practices-mcp:1.0.0

# Run the container
docker run -d \
  --name r-practices \
  -p 3000:3000 \
  alexseymer/r-best-practices-mcp:latest

# Verify it's running
curl http://localhost:3000/health
```

#### Using GitHub Packages

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/alexseymer/r-best-practices-mcp:latest

# Run the container
docker run -d \
  --name r-practices \
  -p 3000:3000 \
  ghcr.io/alexseymer/r-best-practices-mcp:latest
```

#### Using Docker Compose

```bash
# Clone and deploy with Docker Compose
git clone https://github.com/alexseymer/r-coding-mcp.git
cd r-coding-mcp

# Start the API server
docker-compose up -d

# Verify it's running
curl http://localhost:3000/health
```

**Features:**
- 🐳 Container-based deployment for any system
- 🔄 Auto-restart on failure
- 📊 Health checks configured
- 🔒 Security hardened (non-root user)
- 🌐 Optional Nginx reverse proxy with SSL support
- 📦 Volumes for mounting R projects

**For complete Docker documentation**, see [DOCKER.md](./DOCKER.md):
- Configuration options
- SSL/TLS setup
- Production deployment
- Troubleshooting
- Performance tuning
- Security best practices

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port of the web server. |
| `NODE_ENV` | unset | `production` confines paths to `/projects` and disables `/metrics*` unless configured. |
| `ALLOWED_PROJECT_ROOTS` | `/projects` in production | Comma separated directories the web server may analyse. |
| `ALLOW_ANY_PATH` | `false` | `true` allows any absolute path (never on a public server). |
| `METRICS_TOKEN` | unset | Bearer token required for `/metrics*`. |
| `METRICS_PUBLIC` | `false` | `true` serves `/metrics*` without credentials (default outside production). |
| `TRUST_PROXY` | unset (trust nothing) | Reverse proxy hops whose `X-Forwarded-*` headers are trusted: a number (`1`) or an Express value (`loopback`). Needed behind a proxy for per-client rate limits and HSTS. |
| `MAX_BODY_BYTES` | `1048576` | Maximum JSON/form request body. |
| `GIT_SHA`, `BUILD_TIME` | unset | Build information returned by `/health` and `/api/config` (Docker build args of the same name). |

`LOG_LEVEL` appears in `docker-compose.yml` but is not read by the server.

### Verifying a deployment

```bash
curl -s https://your-host/health        # status, version, build.commit, build.builtAt
curl -s https://your-host/api/config    # active path roots, metrics mode, upload limits
curl -sI https://your-host/dashboard    # security headers (CSP, X-Frame-Options, HSTS over HTTPS)
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
// Input (everything except `path` is optional)
{
  "path": "/path/to/project",
  "workflow": "package",
  "minSeverity": "important",        // critical | important | recommended | info (at least this severe)
  "categories": ["testing", "documentation"],
  "maxFindings": 50                  // integer 1-1000
}

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
  "summary": {                       // counted BEFORE the filters above
    "total": 7,
    "bySeverity": { "critical": 1, "important": 2, "recommended": 4, "info": 0 },
    "byCategory": { "testing": 1, "documentation": 3, "structure": 3 }
  },
  "duration": 45
}
```

`validate_file` accepts the same three filters and returns the same `summary`. Invalid filter values are rejected
with an `INVALID_PARAMETER` error (HTTP 400 on the REST API). Every finding id is a practice id (see `get_practice`).

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
// Input (all optional)
{
  "workflow": "package",
  "category": "documentation",
  "minSeverity": "important",        // at least this severe
  "tags": ["roxygen"],               // practice has any of these tags
  "enforcement": "automated",        // automated | guidance
  "query": "namespace",              // case-insensitive text search (id, title, description, details, tags)
  "limit": 20                        // integer 1-200
}

// Output
{
  "practices": [...],
  "total": 3
}
```

The REST API accepts the same filters as query parameters on `GET /api/practices` and `GET /api/v1/practices`:
`workflow`, `category`, `minSeverity`, `tags` (comma separated), `enforcement`, `q` (alias `query`), `limit`.

### Via REST API (HTTP)

When running with Docker or the web server, access the same functionality via HTTP:

#### Recommended: v1 Endpoints (with pagination & enhanced features)

```bash
# Check server health
curl http://localhost:3000/health

# Detect workflow (v1)
curl -X POST http://localhost:3000/api/v1/detect-workflow \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/project"}'

# Validate project (v1)
curl -X POST http://localhost:3000/api/v1/validate-project \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/project", "workflow": "package"}'

# List practices with pagination and filters (v1)
curl "http://localhost:3000/api/v1/practices?limit=50&offset=0&workflow=package&minSeverity=important&enforcement=automated"

# Validate with filters (v1)
curl -X POST http://localhost:3000/api/v1/validate-project \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/project", "minSeverity": "important", "maxFindings": 20}'

# Get practice details (v1)
curl http://localhost:3000/api/v1/practice/pkg-roxygen

# Generate template (v1)
curl -X POST http://localhost:3000/api/v1/generate-template \
  -H "Content-Type: application/json" \
  -d '{"workflow": "package", "projectName": "mypackage"}'
```

#### Upload a project (REST only)

`POST /api/validate-upload` validates a project posted from a browser (the server never sees a path). It is REST only,
not an MCP tool, and is also listed in `/openapi.json`. The files are written to a private temporary directory, analysed and
deleted immediately; nothing is stored.

```bash
curl -X POST http://localhost:3000/api/validate-upload \
  -H "Content-Type: application/json" \
  -d '{"files": [{"path": "DESCRIPTION", "content": "Package: demo\n"}, {"path": "R/a.R", "content": "a <- 1\n"}], "minSeverity": "important"}'
```

Uploaded files are written to a private temporary directory under `UPLOAD_TMP_DIR` (default: the system temp directory) and deleted as soon as the request finishes; point it at a tmpfs or a dedicated volume if you want uploads kept off the main disk.

- Body: `files` (`[{ path, content }]`, paths relative to the project root, `/` or `\` separators) and optional `workflow`
  (detected when omitted), `minSeverity`, `categories`, `maxFindings` (same as `validate-project`), `detectOnly` (return only
  `detected` and `upload`, no findings).
- Response `data`: the `validate-project` fields (`filePath` is the label `uploaded project`, finding `file` values are relative)
  plus `detected` (`workflow`, `confidence`, `indicators`) and `upload` (`files`, `bytes`, `skipped`).
- Limits (also in `GET /api/config` under `upload`): 500 files, 1 MB per file, 5 MB in total, 260 characters per path, 20 levels deep;
  the JSON body may be 8 MB. Only text project files are accepted (`.R .Rmd .qmd .md .yml .yaml .toml .json .lock .txt .dcf ...`
  and files such as `DESCRIPTION`, `NAMESPACE`, `.Rprofile`); other files are skipped and counted in `upload.skipped`.
- Errors: `400 INVALID_PARAMETER` (not an array, empty, absolute path, `.`/`..`/empty segment, control characters, duplicate path,
  wrong types, no supported files), `400 INVALID_WORKFLOW`, `413 PAYLOAD_TOO_LARGE` (file/total/count/body limits),
  `503 BUSY` with `Retry-After` (at most 2 uploads are analysed at the same time).

#### API Documentation

```bash
# View OpenAPI 3.0 specification
curl http://localhost:3000/openapi.json

# Access interactive Swagger UI
open http://localhost:3000/api-docs

# Check rate limit metrics
curl http://localhost:3000/metrics/rate-limit
```

#### Legacy: v0 Endpoints (backward compatible)

v0 endpoints are still available for backward compatibility (no pagination, legacy format):

```bash
# v0 endpoints (deprecated for new code)
curl http://localhost:3000/api/detect-workflow
curl http://localhost:3000/api/practices
curl http://localhost:3000/api/practice/practice-id
```

See [API_VERSIONING.md](./API_VERSIONING.md) for migration guides from v0 to v1.

**Docker Hub:** Pull pre-built images from [Docker Hub](https://hub.docker.com/r/alexseymer/r-best-practices-mcp)

**See [DOCKER.md](./DOCKER.md) for complete API documentation**, including:
- Request/response schemas
- Query parameters and pagination
- Rate limiting configuration
- Error handling
- Security configuration

## Project Structure

```
r-best-practice-mcp/
├── src/
│   ├── engine/
│   │   ├── detector.ts            # Workflow detection (208 lines)
│   │   ├── validator.ts           # Project validation (503 lines)
│   │   └── template-generator.ts  # Template generation (833 lines)
│   ├── data/
│   │   └── knowledge-base.ts      # Loads the 70 practices from data/practices/
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
│   │   ├── security.ts            # Path validation, input sanitization (Phase 3A)
│   │   ├── rate-limiter.ts        # Rate limiting middleware (Phase 3A)
│   │   ├── pagination.ts          # Pagination utilities (Phase 3B)
│   │   └── openapi.ts             # OpenAPI spec generation (Phase 3B)
│   ├── server.ts                  # MCP server (358 lines)
│   ├── web-server.ts              # Express web server with security (Phase 3A/3B)
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
│   ├── unit/                      # Unit tests (100+ tests)
│   │   ├── detector.test.ts
│   │   ├── validator.test.ts
│   │   ├── template-generator.test.ts
│   │   ├── knowledge-base.test.ts
│   │   ├── security.test.ts       # Phase 3A: 30 tests
│   │   ├── rate-limiter.test.ts   # Phase 3A: 10 tests
│   │   └── pagination.test.ts     # Phase 3B: 21 tests
│   └── fixtures/
├── dist/, jest.config.js, tsconfig.json, package.json
├── CLAUDE.md                      # Architecture & development guide
├── SECURITY.md                    # Security best practices (Phase 3C)
├── DEPLOYMENT_CHECKLIST.md        # Production deployment guide (Phase 3C)
├── API_VERSIONING.md              # API versioning strategy (Phase 3C)
├── DOCKER.md                      # Docker deployment guide
├── CONTRIBUTING.md
└── README.md
```

## CI/CD Pipeline

This project uses **GitHub Actions** for automated testing, building, and releasing:

- **Build Workflow** — Runs on every push and PR
  - ESLint linting
  - TypeScript building
  - Jest unit tests with coverage
  - Type checking
  - Matrix testing on Node 18.x and 20.x

- **Publish Workflow** — Triggered by version tags (v*.*.*)
  - Runs full test suite
  - Publishes to npm registry
  - Builds and pushes Docker images to:
    - Docker Hub (`alexseymer/r-best-practices-mcp`)
    - GitHub Packages (`ghcr.io/alexseymer/r-best-practices-mcp`)
  - Creates GitHub Release with installation instructions
  - Uses semantic versioning for tags

**Publishing** is fully automated via GitHub Actions:
1. Push a version tag: `git tag v1.0.0 && git push origin v1.0.0`
2. The workflow automatically publishes to npm and Docker registries
3. GitHub Release is created with release notes

For detailed publishing instructions, see [PUBLISH.md](./PUBLISH.md) and [docs/versioning.md](./docs/versioning.md).

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

The knowledge base includes 70 best practices. 59 are *automated* (a validator rule reports violations);
11 are *guidance only* (they need R to run, runtime behaviour or judgement, so they never produce findings):

**R Scripts** (7) — Headers, functions, naming, sections, error handling, cleanup  
**Quarto** (7) — Chunk labels and options, YAML, caching, figures, tables, narrative  
**R Markdown** (4) — YAML, chunks, options, inline code  
**Shiny** (8) — Structure, separation, modules, validation, reactivity, feedback  
**Packages** (10) — roxygen2, NAMESPACE, DESCRIPTION, tests, vignettes, license, check, coverage  
**renv** (4) — Init, lock, snapshot, restore  
**targets** (4) — Structure, naming, dependencies, branching  
**Plumber** (6) — Paths, docs, validation, responses, status codes, errors  
**Analysis** (3) — Directory structure, README, version control  
**bookdown** (6) — Config, index, chapter naming, output formats, cross-references, README  
**blogdown** (5) — Config, content structure, themes, front matter, deployment  
**shinytest** (6) — Test structure, app, setup, recordings, unit tests, CI  

Browse them in the dashboard (Practices tab), via `list_practices`, or `GET /api/practices`.

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

### 🌐 REST API (HTTP)
Deploy as a web service with Docker for easy integration:
- Express.js HTTP server on port 3000
- All 6 tools available via REST endpoints
- Health checks and API introspection
- Optional Nginx reverse proxy with SSL/TLS
- Perfect for self-hosted VPS deployment
- Start with `docker-compose up` or `node dist/web-server-entry.js`
- [See Docker documentation](./DOCKER.md)

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

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — Architecture, design decisions, development workflow
- **[SECURITY.md](./SECURITY.md)** — Security best practices, configuration, hardening
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** — Production deployment guide with Docker & K8s
- **[API_VERSIONING.md](./API_VERSIONING.md)** — API versioning strategy and migration guides
- **[DOCKER.md](./DOCKER.md)** — Docker deployment, SSL/TLS, production configuration
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Contributing guidelines

## Support

- **Issues**: [GitHub Issues](https://github.com/alexseymer/r-coding-mcp/issues)
- **Questions**: [GitHub Discussions](https://github.com/alexseymer/r-coding-mcp/discussions)
- **Security**: Email alexseymer@gmail.com with security concerns
- **Publishing**: [PUBLISH.md](./PUBLISH.md)
- **Versioning**: [docs/versioning.md](./docs/versioning.md)
