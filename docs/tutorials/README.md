# R Best Practices - Tutorials & Guides

Complete learning resources for all 4 interfaces of the R Best Practices system.

## Quick Navigation

### Getting Started
- **New to the project?** Start with [Quick Start Guide](#quick-start)
- **Want to use a specific interface?** See [By Interface](#by-interface)
- **Learning best practices?** See [Deep Dive](#deep-dive)

## Quick Start

Choose your starting point:

**For MCP/Claude users:**
→ [MCP Integration Guide](01-mcp-integration.md)

**For CLI users:**
→ [CLI Quick Start](02-cli-quickstart.md)

**For VS Code users:**
→ [VS Code Setup Tutorial](03-vscode-setup.md)

**For RStudio users:**
→ [RStudio Addin Setup](04-rstudio-setup.md)

## By Interface

### 🖥️ MCP Server (Claude Integration)
**[01-mcp-integration.md](01-mcp-integration.md)**
- What is MCP and why use it?
- Installation and setup
- All 6 tools documented with examples
- Error handling
- Integration with Claude

**Best for:** Claude users, developers building MCP clients

---

### 💻 Command Line Interface (CLI)
**[02-cli-quickstart.md](02-cli-quickstart.md)**
- Installation via npm
- 4 core commands (detect, validate, template, report)
- Advanced usage (filtering, watch mode, JSON output)
- Common workflows
- Troubleshooting

**Best for:** Terminal users, automation, CI/CD

---

### 📌 VS Code Extension
**[03-vscode-setup.md](03-vscode-setup.md)**
- Installation from marketplace
- Configuration and settings
- Inline diagnostics and quick fixes
- Command palette integration
- Workflows within VS Code
- Performance tips

**Best for:** VS Code users, IDE-based validation

---

### 🎨 RStudio Addin
**[04-rstudio-setup.md](04-rstudio-setup.md)**
- Installation from GitHub
- 4 interactive gadgets
- Accessing addins from RStudio menu
- Workflows with RStudio
- Troubleshooting
- Integration with R workflows

**Best for:** RStudio users, R developers

---

## Deep Dive

### 📚 Best Practices by Workflow
**[05-best-practices-deep-dive.md](05-best-practices-deep-dive.md)**

Comprehensive guide to all 52 practices organized by workflow:

- **R Scripts** (7) - Headers, functions, naming, comments, cleanup
- **Shiny Apps** (7) - Validation, feedback, reactivity, modules
- **Packages** (9) - roxygen2, tests, DESCRIPTION, LICENSE
- **Data Analysis** (3) - Directory structure, documentation, README
- **Quarto** (7) - YAML, chunks, caching, figures, tables
- **R Markdown** (4) - YAML headers, chunk options
- **renv** (4) - Initialization, locking, snapshots
- **targets** (4) - Structure, naming, dependencies
- **Plumber** (6) - Validation, endpoints, error handling

**Best for:** Understanding what makes good R code

---

### ⚡ Automated Fixes
**[06-automated-fixes.md](06-automated-fixes.md)**

Learn to automate common fixes:

- **6 automated fixes** explained with examples
- **add-function-docs** - roxygen2 templates
- **add-library** - Missing imports
- **standardize-assignment** - = to <- conversion
- **add-braces** - Style consistency
- **remove-trailing-whitespace** - Cleanup
- **add-namespace** - pkg::function notation

Workflows:
- Package publishing workflow
- Project cleanup
- Dry runs and interactive mode
- Integration with validation
- CI/CD integration

**Best for:** Batch fixing issues, code cleanup

---

## Example Projects

5 complete, ready-to-validate example projects in `/examples/`:

### 1. example-r-script/
Simple R script with best practices:
- File headers
- Function organization
- Error handling
- Consistent styling

### 2. example-package/
Complete R package example:
- DESCRIPTION and NAMESPACE
- roxygen2 documentation
- Function implementations
- testthat test suite

### 3. example-shiny-app/
Shiny application with best practices:
- UI/server organization
- Input validation
- Reactive programming
- Error handling

### 4. example-quarto-doc/
Reproducible Quarto document:
- YAML front matter
- Code chunk labels
- Caching configuration
- Visualization with captions

### 5. example-data-analysis/
Data analysis project structure:
- Organized directories (data/, R/, output/)
- Numbered scripts (01_load, 02_clean, 03_analyze)
- README documentation
- Standard workflow

**Use these to:**
- See best practices in action
- Validate against your own projects
- Learn by example
- Copy as templates

---

## Learning Paths

### Path 1: New to R Best Practices
1. Read [Quick Start Guide](#quick-start)
2. Choose your interface (CLI, VS Code, or RStudio)
3. Follow the setup tutorial
4. Validate an example project
5. Read [Best Practices Deep Dive](05-best-practices-deep-dive.md) for your workflow

### Path 2: R Package Developer
1. [RStudio Addin Setup](04-rstudio-setup.md)
2. [Best Practices Deep Dive](05-best-practices-deep-dive.md) → Packages section
3. Explore [example-package/](../examples/example-package/)
4. Validate your own package
5. Apply [Automated Fixes](06-automated-fixes.md)

### Path 3: Data Analyst
1. [CLI Quick Start](02-cli-quickstart.md)
2. [Best Practices Deep Dive](05-best-practices-deep-dive.md) → Data Analysis & R Scripts
3. Explore [example-data-analysis/](../examples/example-data-analysis/)
4. Generate template: `r-practices template analysis`
5. Build your analysis with best practices

### Path 4: Shiny Developer
1. [VS Code Setup](03-vscode-setup.md) or [RStudio Addin Setup](04-rstudio-setup.md)
2. [Best Practices Deep Dive](05-best-practices-deep-dive.md) → Shiny Apps section
3. Explore [example-shiny-app/](../examples/example-shiny-app/)
4. Validate Shiny projects as you develop
5. Use quick fixes for code cleanup

### Path 5: CI/CD Integration
1. [CLI Quick Start](02-cli-quickstart.md)
2. [Automated Fixes](06-automated-fixes.md)
3. Set up validation in GitHub Actions
4. Configure auto-fixes on pull requests
5. Generate reports for code review

---

## Key Concepts

### The 4 Interfaces

| Interface | Use Case | Speed | Interactivity |
|-----------|----------|-------|----------------|
| **MCP** | Claude/AI assistants | Real-time | High (conversation) |
| **CLI** | Automation, CI/CD | Fast | Low (command-line) |
| **VS Code** | IDE integration | Real-time | High (editor) |
| **RStudio** | R development | Interactive | High (dialogs) |

### The 52 Best Practices

Organized by:
- **Workflow Type** - 9 types (scripts, packages, Shiny, etc.)
- **Category** - Structure, naming, docs, testing, etc.
- **Severity** - Critical, important, recommended, info

### The 3 Core Components

1. **WorkflowDetector** - Identifies project type
2. **Validator** - Checks against practices
3. **TemplateGenerator** - Creates scaffolds

---

## Frequently Asked Questions

**Q: Which interface should I use?**
A: Choose based on your workflow:
- Daily R development → RStudio or VS Code
- Automation/CI/CD → CLI
- Working with Claude → MCP
- Quick checks → Any interface

**Q: Can I use multiple interfaces?**
A: Yes! They all validate against the same rules. Use whichever is most convenient for each task.

**Q: How do I update the tool?**
A: Depends on how you installed:
- npm: `npm update -g r-practices`
- GitHub: `git pull && npm install && npm run build`

**Q: Can I add custom rules?**
A: Yes! See [Community Best Practices](../community-rules.md) (Phase 8 feature)

**Q: Are there video tutorials?**
A: Yes, check the [main README](../../README.md) for video links.

---

## Next Steps

1. **Choose your learning path** from above
2. **Follow the setup tutorial** for your interface
3. **Explore the example projects** relevant to your workflow
4. **Validate your own projects** and review findings
5. **Apply best practices** and watch your code improve

---

## Resources

- [Main README](../../README.md) - Project overview
- [CLAUDE.md](../../CLAUDE.md) - Architecture guide
- [Example Projects](../examples/) - Ready-to-validate samples
- [R Style Guide](https://style.tidyverse.org/) - External reference
- [Shiny Best Practices](https://shiny.rstudio.com/articles/) - External reference

---

## Troubleshooting

**Can't find what you're looking for?**
- Check the table of contents above
- Use Ctrl+F to search within a tutorial
- See the [Main README](../../README.md) for installation help

**Found an error in tutorials?**
- Report an issue on [GitHub](https://github.com/alexseymer/r-best-practice-mcp/issues)
- Suggest improvements in discussions

**Want more tutorials?**
- Check [GitHub Issues](https://github.com/alexseymer/r-best-practice-mcp/issues) for planned content
- Comment with your tutorial requests

---

**Last updated:** 2026-09-26  
**Version:** Phase 8 Documentation
