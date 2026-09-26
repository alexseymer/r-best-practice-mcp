# CLI Quick Start Guide

Get up and running with the r-practices command-line tool.

## Installation

```bash
npm install -g r-practices
```

Verify installation:
```bash
r-practices --version
```

## Basic Commands

### Detect Workflow Type

Identify what type of R project you're working with:

```bash
r-practices detect /path/to/project
```

Output:
```
Detected Workflow: package
Confidence: 95%
Indicators: DESCRIPTION, R/, tests/testthat/
```

### Validate Project

Check your project against best practices:

```bash
r-practices validate /path/to/project
```

This analyzes the project structure and R files, returning findings organized by severity:
- **Critical** - Must fix (missing DESCRIPTION, no LICENSE)
- **Important** - Should fix (no tests, missing documentation)
- **Recommended** - Nice to have (code style, naming conventions)
- **Info** - Additional information

### Generate Template

Create a new project from a template:

```bash
r-practices template package --name my-package
```

This creates a new directory with:
- DESCRIPTION file
- NAMESPACE file
- R/ directory structure
- tests/ with testthat setup
- README.md
- LICENSE

Available workflows:
- `r-script` - Standalone R script
- `package` - R package
- `shiny` - Shiny web application
- `quarto` - Quarto document
- `rmarkdown` - R Markdown report
- `analysis` - Data analysis project
- `renv` - renv-managed project
- `targets` - targets pipeline
- `plumber` - Plumber API

### Generate Report

Create a styled HTML validation report:

```bash
r-practices report /path/to/project --output report.html
```

Opens a browser with:
- Summary statistics (counts by severity)
- Color-coded findings table
- Detailed suggestions
- Printable format

## Advanced Usage

### Filter by Severity

Only show critical issues:

```bash
r-practices validate . --severity critical
```

### Filter by Category

Show only documentation issues:

```bash
r-practices validate . --category documentation
```

### Limit Results

Show top 20 findings:

```bash
r-practices validate . --limit 20
```

### Watch Mode

Continuously monitor and revalidate on file changes:

```bash
r-practices validate . --watch
```

This watches all R files and reruns validation every time you save, perfect for development.

### Output Formats

JSON output for scripting:

```bash
r-practices detect . --json
```

## Examples

### Validate Current Directory

```bash
r-practices validate .
```

### Validate Specific File

```bash
r-practices validate ./R/functions.R
```

### Generate Quarto Template

```bash
r-practices template quarto \
  --name my-analysis \
  --author "Jane Doe" \
  --email "jane@example.com"
```

### Create Report and Open

```bash
r-practices report . --output report.html
open report.html
```

### Watch During Development

```bash
# In one terminal
r-practices validate . --watch

# In another, edit your code - watch terminal updates automatically
```

## Understanding Results

### Finding Components

Each finding includes:

- **ID**: Unique identifier (e.g., "pkg-roxygen")
- **Severity**: critical, important, recommended, info
- **Category**: structure, naming, documentation, testing, etc.
- **Message**: Description of the issue
- **Suggestions**: How to fix it
- **File**: (if applicable) Which file has the issue
- **Line**: (if applicable) Line number

### Common Issues by Workflow

**R Package:**
- Missing roxygen2 documentation
- No tests in tests/testthat/
- Incomplete DESCRIPTION
- Missing LICENSE

**Shiny App:**
- No input validation
- Missing error handling
- Unclear reactivity patterns

**R Script:**
- No file header
- Global variables
- No functions
- Missing comments

## Troubleshooting

**Command not found:**
```bash
# Verify installation
npm list -g r-practices

# Reinstall if needed
npm install -g r-practices
```

**Permission denied:**
```bash
# Fix permissions
sudo npm install -g r-practices

# Or use a different location
npm install r-practices --prefix ~/.local
export PATH=~/.local/bin:$PATH
```

**Reports not opening:**
```bash
# Specify full path
r-practices report . --output /tmp/report.html
open /tmp/report.html
```

## Next Steps

- Review the generated report
- Visit each suggestion's practice in the knowledge base
- Check out the example projects in /examples
- Try the VS Code extension for IDE integration
- Set up automated validation with --watch mode
