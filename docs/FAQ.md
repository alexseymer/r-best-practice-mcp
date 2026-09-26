# Frequently Asked Questions (FAQ)

**Last Updated**: 2026-09-26

## Table of Contents

1. [General Questions](#general-questions)
2. [Installation & Setup](#installation--setup)
3. [Usage & Features](#usage--features)
4. [Development & Testing](#development--testing)
5. [Deployment & DevOps](#deployment--devops)
6. [Troubleshooting](#troubleshooting)
7. [Performance & Optimization](#performance--optimization)
8. [Contributing & Community](#contributing--community)

---

## General Questions

### What is the R Best Practices MCP Server?

The R Best Practices MCP Server is a tool that helps R developers follow best practices across different project types. It:
- Detects your R project type (package, Shiny app, analysis, etc.)
- Validates projects against 52+ best practices
- Generates starter templates for new projects
- Provides knowledge base access to practice documentation

### What workflows does it support?

9 standard R workflows:
- **r-script** — Standalone R scripts
- **quarto** — Quarto documents for reproducible analysis
- **shiny** — Interactive web applications
- **package** — R packages for distribution
- **rmarkdown** — R Markdown documents
- **renv** — Projects with isolated dependencies
- **targets** — Data pipelines using targets
- **plumber** — REST APIs with Plumber
- **analysis** — Data analysis projects

### Is this an official Posit/RStudio product?

No, this is a community-driven project that aggregates R best practices. It's inspired by R Tidyverse style guides, Shiny best practices, and R package development standards.

### Can I use this with Claude?

Yes! The server is designed to work with Claude via the Model Context Protocol (MCP). See [01-mcp-integration.md](./tutorials/01-mcp-integration.md) for setup instructions.

### What license is this under?

MIT License — free to use, modify, and distribute. See LICENSE file in the repository.

---

## Installation & Setup

### How do I install the MCP server?

**Option 1: From npm registry** (recommended)
```bash
npm install r-best-practices-mcp
node node_modules/r-best-practices-mcp/dist/index.js
```

**Option 2: From source**
```bash
git clone https://github.com/alexseymer/r-coding-mcp.git
cd r-coding-mcp
npm install
npm run build
node dist/index.js
```

**Option 3: Docker**
```bash
docker pull alexseymer/r-best-practices-mcp:latest
docker run -it alexseymer/r-best-practices-mcp:latest
```

### How do I set up with Claude?

1. Install the package: `npm install r-best-practices-mcp`
2. In Claude settings, add the MCP server
3. Point to the binary: `node /path/to/node_modules/r-best-practices-mcp/dist/index.js`
4. Restart Claude to activate

See detailed instructions: [01-mcp-integration.md](./tutorials/01-mcp-integration.md)

### Can I use this with other MCP clients?

Yes! The server uses the standard MCP protocol and works with any MCP-compatible client. Tested with Claude and Claude Code.

### How do I install the CLI tool?

```bash
# From npm
npm install -g r-best-practices-mcp

# Or use directly
npx r-best-practices-mcp detect .
```

Then use commands like:
```bash
r-practices detect .
r-practices validate . --workflow package
r-practices template shiny --name my-app
r-practices report . --output report.html
```

See: [02-cli-quickstart.md](./tutorials/02-cli-quickstart.md)

### How do I install the VS Code extension?

The VS Code extension can be installed via:

**Option 1: From VSIX file**
1. Download the extension from releases
2. `code --install-extension r-best-practices-mcp.vsix`

**Option 2: From source**
1. Clone the repository
2. Navigate to `vscode-extension/`
3. `npm install && npm run build`
4. Press F5 to open extension in debug mode

See: [03-vscode-setup.md](./tutorials/03-vscode-setup.md)

### How do I install the RStudio addin?

The RStudio addin can be installed via:

```R
# From GitHub
devtools::install_github("alexseymer/r-coding-mcp/rstudio-addin")

# Or from CRAN (when released)
install.packages("rbestpractices")
```

Then access via RStudio menu: **Addins → R Best Practices**

See: [04-rstudio-setup.md](./tutorials/04-rstudio-setup.md)

---

## Usage & Features

### How do I detect my project type?

Using the MCP server with Claude:
```
Ask Claude: "Can you detect what type of R project this is?"
Claude will run: detect_workflow tool
```

Using the CLI:
```bash
r-practices detect /path/to/project
```

Output shows: workflow type, confidence %, and detected indicators

### What does validation check?

Validation checks your project against 52+ best practices including:
- **Structure** — Required directories and files
- **Documentation** — README, DESCRIPTION, comments
- **Testing** — Test files and coverage
- **Naming** — Variable and function naming conventions
- **Performance** — Code efficiency and optimization
- **Security** — Dependency management, secrets handling
- **Dependencies** — Version control and isolation
- **Style** — Code formatting and consistency

See: [05-best-practices-deep-dive.md](./tutorials/05-best-practices-deep-dive.md)

### How do I validate my project?

Using Claude:
```
Ask Claude: "Validate my R package project"
```

Using the CLI:
```bash
r-practices validate /path/to/project --workflow package
```

Using the HTTP API:
```bash
curl -X POST http://localhost:3000/api/validate-project \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/project", "workflow": "package"}'
```

### Can I filter validation results by severity?

Yes! Using the CLI:
```bash
r-practices validate . --severity critical,important
```

Using the HTTP API:
```bash
curl "http://localhost:3000/api/validate-project?severity=critical,important"
```

Using MCP with Claude:
```
"Validate my project but only show critical and important issues"
```

### How do I generate a template for a new project?

Using Claude:
```
Ask Claude: "Generate a template for a new Shiny application called 'my-app'"
```

Using the CLI:
```bash
r-practices template shiny --name my-app --author "John Doe"
```

Templates include:
- Directory structure
- Example code files
- Configuration files
- README.md
- .gitignore
- LICENSE

### What can the auto-fixes do?

The auto-fixes engine can automatically fix:
- Generate roxygen2 documentation
- Fix import statements
- Normalize whitespace
- Apply consistent formatting
- Organize code structure

See: [06-automated-fixes.md](./tutorials/06-automated-fixes.md)

### How do I access the knowledge base?

Using Claude:
```
"Show me best practices for R packages"
"Tell me about the pkg-roxygen practice"
```

Using the CLI/HTTP API:
```bash
# List all practices
curl http://localhost:3000/api/practices

# Filter by workflow
curl "http://localhost:3000/api/practices?workflow=package"

# Get specific practice
curl http://localhost:3000/api/practice/pkg-roxygen2
```

---

## Development & Testing

### How do I run the tests?

```bash
# All tests
npm test

# Specific test suite
npm test -- detector.test.ts

# Watch mode for development
npm run test:watch

# With coverage report
npm test -- --coverage
```

### What's the test coverage?

- **Overall**: ~90% in tested components
- **Knowledge Base**: 100%
- **File Utilities**: 100%
- **Detector**: ~88%
- **Template Generator**: ~98%
- **Validator**: ~61%

See: [TESTING.md](./TESTING.md) for detailed breakdown

### How do I add a new workflow type?

1. **Add type definition** in `src/types/workflow.ts`
2. **Add detection logic** in `src/engine/detector.ts`
3. **Add validator** in `src/engine/validator.ts`
4. **Add template** in `src/engine/template-generator.ts`
5. **Add practices** in `src/data/knowledge-base.ts`
6. **Add tests** in `tests/unit/`

See: [docs/ARCHITECTURE.md](./ARCHITECTURE.md#adding-a-new-workflow-type)

### How do I add custom validation rules?

Edit `src/config/rules-engine.ts`:
```typescript
const customRules = [
  {
    id: 'my-rule-id',
    workflow: 'package',
    category: 'documentation',
    severity: 'recommended',
    pattern: /pattern/,
    message: 'Custom message',
    suggestions: ['Fix 1', 'Fix 2'],
  },
]
```

### How do I add a new best practice?

Edit `src/data/knowledge-base.ts`:
```typescript
{
  id: 'unique-id',
  title: 'Practice Title',
  workflow: 'package',
  category: 'documentation',
  severity: 'important',
  description: 'Detailed explanation...',
  examples: ['code example...'],
}
```

### Can I run tests in watch mode?

Yes!
```bash
npm run test:watch
```

This re-runs tests on file changes during development.

---

## Deployment & DevOps

### How do I deploy the HTTP API?

**Using Docker Compose** (recommended):
```bash
docker-compose up -d
# API runs on http://localhost:3000
```

**Using Docker directly**:
```bash
docker run -d -p 3000:3000 alexseymer/r-best-practices-mcp:latest
```

**Using Node.js**:
```bash
node dist/web-server-entry.js
```

See: [DOCKER.md](../DOCKER.md)

### How do I set up SSL/TLS?

The Docker setup includes Nginx with SSL support. Edit `docker-compose.yml`:
```yaml
environment:
  - ENABLE_SSL=true
  - SSL_CERT=/path/to/cert.pem
  - SSL_KEY=/path/to/key.pem
```

See: [DOCKER.md](../DOCKER.md#ssl-setup)

### How do I publish a new version?

1. Update version in `package.json`
2. Create git tag: `git tag v1.0.0`
3. Push tag: `git push origin v1.0.0`
4. GitHub Actions automatically publishes to npm and Docker

See: [PUBLISH.md](../PUBLISH.md)

### Can I use environment variables for configuration?

Yes! Supported variables:
- `PORT` — HTTP server port (default: 3000)
- `LOG_LEVEL` — debug, info, warn, error (default: info)
- `MCP_TRANSPORT` — stdio or http (default: stdio)

### How do I monitor the deployed service?

Health check endpoint:
```bash
curl http://localhost:3000/health
```

Returns:
```json
{
  "status": "ok",
  "uptime": 12345,
  "version": "1.0.0"
}
```

### Can I use this in CI/CD pipelines?

Yes! The CLI tool works great in CI/CD:
```bash
# Validate all projects in CI
r-practices validate . --severity critical

# Fail if critical issues found
if [ $? -ne 0 ]; then
  echo "Critical issues found!"
  exit 1
fi
```

---

## Troubleshooting

### The MCP server won't start

**Error**: `Cannot find module`
- Solution: Run `npm run build` to compile TypeScript
- Check: Node.js version >= 18.0.0

**Error**: `stdin/stdout not connected`
- Solution: Ensure you're running via MCP client (Claude, etc.)
- Check: Not trying to run interactively

### Validation not detecting issues

**Problem**: Expected finding not shown
- Check: Correct workflow type is detected
- Check: Severity/category filters aren't hiding it
- Solution: Run `r-practices validate . --workflow <type>` to verify

### CLI tool not found

**Error**: `command not found: r-practices`
- Solution: Install globally: `npm install -g r-best-practices-mcp`
- Or: Use full path: `node /path/to/node_modules/r-best-practices-mcp/dist/index.js`

### Docker container won't start

**Error**: `Port 3000 already in use`
- Solution: Change port: `docker run -p 3001:3000 ...`
- Or: Kill existing: `lsof -ti:3000 | xargs kill -9`

**Error**: `Cannot find R project at path`
- Solution: Ensure path is absolute and accessible
- Check: Path exists and has correct permissions

### VS Code extension not working

**Problem**: Extension doesn't appear in command palette
- Solution: Reload VS Code window (Cmd+Shift+P → "Reload Window")
- Check: Extension is enabled in VS Code extensions

**Problem**: Diagnostics not showing
- Solution: Ensure project is open as a folder (not single file)
- Check: R files exist in workspace

### RStudio addin not appearing

**Problem**: Addin not in "Addins" menu
- Solution: Restart RStudio
- Check: Package installed: `.libPaths()` and `library(rbestpractices)`

**Problem**: MCP connection error
- Solution: Ensure MCP server is running
- Check: Network connectivity between RStudio and MCP server

### Performance issues

**Problem**: Validation takes >5 seconds
- Causes: Large project, many files, slow disk
- Solution: Use `--limit` flag to reduce findings
- Try: Validate specific files instead of whole project

**Problem**: High memory usage
- Solution: Process large projects file-by-file
- Try: Run in Docker with memory limits: `docker run -m 512m ...`

### HTTP API returning 500 errors

**Problem**: `Internal Server Error`
- Solution: Check server logs: `docker logs <container-id>`
- Try: Validate input JSON format
- Check: Path exists on server's filesystem

---

## Performance & Optimization

### How fast is detection?

Typical performance: **50-100ms per project**

Factors affecting speed:
- Directory depth (recursive scanning)
- Number of files
- Disk speed (HDD vs SSD)

### How fast is validation?

Typical performance: **100-500ms per project**

Depends on:
- Project size (number of files)
- Number of validation checks
- Complexity of files

### Can I speed up validation?

Yes! Several options:

1. **Limit findings**: `--limit 20` to stop after 20 findings
2. **Filter by severity**: `--severity critical` to skip unimportant issues
3. **Validate files**: Check individual files instead of whole project
4. **Parallel validation**: Use multiple concurrent validations

### What about large projects (1000+ files)?

Large projects still process quickly because:
- Validation is parallelizable
- File filtering is efficient
- No full file parsing required

For very large projects:
```bash
# Validate only R files
r-practices validate . --pattern "*.R"

# Validate one file at a time
r-practices validate src/myfile.R
```

### How can I profile performance?

```bash
# Time the operation
time r-practices validate .

# With debug logging
LOG_LEVEL=debug r-practices validate .
```

---

## Contributing & Community

### How do I report bugs?

1. Check existing issues: [GitHub Issues](https://github.com/alexseymer/r-coding-mcp/issues)
2. Create new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment info (OS, Node version)

### How do I suggest new features?

1. Check existing discussions: [GitHub Discussions](https://github.com/alexseymer/r-coding-mcp/discussions)
2. Create discussion or issue with:
   - Feature description
   - Use cases
   - Proposed implementation (optional)

### How do I contribute code?

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines:

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes and test: `npm test`
4. Commit with clear message
5. Submit pull request

### What are the contribution guidelines?

Key guidelines:
- Use TypeScript with strict mode
- Write tests for new features
- Follow existing code style
- Update documentation
- Write clear commit messages

See [CONTRIBUTING.md](../CONTRIBUTING.md)

### Can I request a new workflow type?

Yes! Please:
1. Open an issue describing the workflow
2. Provide examples of typical projects
3. List key files/structures for detection
4. Reference best practices for the workflow

Example: [Issue: Add bookdown workflow](https://github.com/alexseymer/r-coding-mcp/issues)

### How do I stay updated?

- **Releases**: Watch releases on [GitHub Releases](https://github.com/alexseymer/r-coding-mcp/releases)
- **Changes**: See [CHANGELOG](../PROJECT_STATUS.md) for completion history
- **Roadmap**: Check [ROADMAP.md](../ROADMAP.md) for planned features

### Where can I get help?

1. **Documentation**: [docs/INDEX.md](./INDEX.md)
2. **FAQ**: You're reading it!
3. **Issues**: [GitHub Issues](https://github.com/alexseymer/r-coding-mcp/issues)
4. **Discussions**: [GitHub Discussions](https://github.com/alexseymer/r-coding-mcp/discussions)
5. **Email**: Open an issue for direct contact

### Can I use this for commercial projects?

Yes! MIT License allows commercial use. No attribution required, but appreciated.

### Is there a community slack/discord?

Not currently, but interested community members can:
- Open discussions on GitHub
- Contribute to the project
- Request community features

---

## Additional Resources

### Documentation
- **[docs/INDEX.md](./INDEX.md)** — Complete documentation index
- **[docs/ARCHITECTURE.md](./ARCHITECTURE.md)** — System architecture
- **[docs/TESTING.md](./TESTING.md)** — Testing guide
- **[docs/tutorials/](./tutorials/)** — Step-by-step guides

### Important Files
- **[README.md](../README.md)** — Main user guide
- **[CLAUDE.md](../CLAUDE.md)** — Development guide
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** — Contribution guidelines
- **[ROADMAP.md](../ROADMAP.md)** — Future roadmap

### External Resources
- **[R Tidyverse Style Guide](https://style.tidyverse.org/)** — R code style
- **[Shiny Best Practices](https://shiny.rstudio.com/articles/basics.html)** — Shiny patterns
- **[R Packages Book](https://r-pkgs.org/)** — Package development
- **[MCP Documentation](https://modelcontextprotocol.io/)** — Protocol overview

---

**Last Updated**: 2026-09-26  
**Found an issue in this FAQ?** [Report it on GitHub](https://github.com/alexseymer/r-coding-mcp/issues)
