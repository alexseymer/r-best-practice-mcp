# CLI Guide - R Best Practices Command Line Tool

## Overview

The R Best Practices CLI provides developers with powerful command-line tools for workflow detection, project validation, template generation, and report generation.

---

## Installation

### From npm Registry

```bash
npm install -g r-best-practices-mcp
```

### From Source

```bash
git clone https://github.com/alexseymer/r-best-practices-mcp.git
cd r-best-practices-mcp
npm install
npm run build
npm link  # Creates global symlink
```

---

## Usage

### Basic Syntax

```bash
r-best-practices <command> [options] [arguments]
```

### Getting Help

```bash
# Show all available commands
r-best-practices help

# Show version
r-best-practices version
```

---

## Commands

### 1. `detect` — Identify Workflow Type

Automatically detects the R workflow type for a project.

#### Syntax

```bash
r-best-practices detect [path] [options]
```

#### Arguments

- `path` — Project directory path (default: current directory)

#### Options

- `--format <format>` — Output format: `text` (default), `json`
- `--quiet` — Suppress non-essential output
- `--verbose` — Show detailed analysis

#### Examples

```bash
# Detect workflow in current directory
r-best-practices detect

# Detect in specific directory
r-best-practices detect /path/to/project

# Get JSON output for programmatic use
r-best-practices detect . --format json

# Verbose output showing all indicators
r-best-practices detect . --verbose
```

#### Output

**Text Format:**
```
ℹ Detecting workflow for: /home/user/my-project

═══════════════════════════════════════════════════════
Workflow Detection Result
═══════════════════════════════════════════════════════

Workflow:   package
Confidence: [██████████░░░░░░░░] 95%

Detected Indicators
  • DESCRIPTION
  • R/
  • tests/testthat/
  • man/
  • .Rbuildignore
```

**JSON Format:**
```json
{
  "workflow": "package",
  "confidence": 95,
  "indicators": ["DESCRIPTION", "R/", "tests/testthat/"]
}
```

---

### 2. `validate` — Check Best Practices

Validates a project against best practices with detailed findings.

#### Syntax

```bash
r-best-practices validate <path> [workflow] [options]
```

#### Arguments

- `path` — Project directory path (required)
- `workflow` — Workflow type (auto-detected if omitted)

#### Options

- `--watch` — Watch for changes and re-validate
- `--format <format>` — Output format: `text` (default), `json`, `html`
- `--output <path>` — Output directory for results
- `--severity <level>` — Filter by severity: `critical`, `important`, `recommended`, `info`
- `--category <category>` — Filter by category: `structure`, `naming`, `documentation`, `security`, `testing`, `performance`, etc.
- `--limit <number>` — Limit results (default: all)
- `--quiet` — Suppress non-essential output

#### Examples

```bash
# Basic validation
r-best-practices validate .

# Validate with known workflow type
r-best-practices validate /path/to/project package

# Watch mode - re-validate on file changes
r-best-practices validate . --watch

# Get only critical issues
r-best-practices validate . --severity critical

# Get JSON output for parsing
r-best-practices validate . --format json

# Save results to file
r-best-practices validate . --output ./reports --format json

# Filter by category
r-best-practices validate . --category testing
```

#### Output

**Text Format:**
```
ℹ Validating project: /home/user/my-project

═══════════════════════════════════════════════════════
Project Validation Result
═══════════════════════════════════════════════════════

CRITICAL (2)
✗ Missing LICENSE file
   → Add a LICENSE file (MIT, GPL, Apache, etc.)
   → Reference in DESCRIPTION
✗ Missing NAMESPACE file
   → Create NAMESPACE with roxygen2 or manually
   → Document exports and imports

IMPORTANT (3)
⚠ No README.md
   → Add comprehensive README.md
   → Include usage examples

═══════════════════════════════════════════════════════
Summary
═══════════════════════════════════════════════════════

Total Findings: 5
Duration:      234ms
```

**Watch Mode:**
```
ℹ Watching /home/user/my-project for changes...
⚠ Press Ctrl+C to stop

[10:30:45] File changed: R/utils.R
ℹ Validating project: /home/user/my-project
✓ No critical issues found
```

---

### 3. `template` — Generate Project Scaffold

Creates a complete project scaffold for a specific workflow.

#### Syntax

```bash
r-best-practices template <workflow> [projectName] [options]
```

#### Arguments

- `workflow` — Workflow type (required): `r-script`, `quarto`, `shiny`, `package`, `rmarkdown`, `renv`, `targets`, `plumber`, `analysis`
- `projectName` — Name for new project (default: `my-project`)

#### Options

- `--output <path>` — Output directory (default: current directory)
- `--author <name>` — Author name
- `--email <email>` — Author email
- `--force` — Overwrite existing directory
- `--format <format>` — Output format: `text` (default), `json`
- `--quiet` — Suppress non-essential output

#### Examples

```bash
# Create Shiny app template
r-best-practices template shiny my-app

# Create package template with author info
r-best-practices template package my-pkg \
  --author "John Doe" \
  --email "john@example.com"

# Create in specific directory
r-best-practices template quarto my-analysis \
  --output ~/projects

# Overwrite existing
r-best-practices template package existing-project --force

# JSON output for automation
r-best-practices template package new-pkg --format json
```

#### Output

**Text Format:**
```
ℹ Generating shiny template: my-app

═══════════════════════════════════════════════════════
Template Generated Successfully
═══════════════════════════════════════════════════════

Location:   /home/user/my-app
Files:      12
Directories: 4

Next Steps
  cd my-app
  # Edit files as needed
  git init
  git add .
  git commit -m "Initial commit"
```

#### Generated Structure (Example: Shiny)

```
my-app/
├── app.R                 # Main Shiny application
├── README.md             # Project documentation
├── .gitignore            # Git ignore file
├── .Rprofile             # R profile
├── renv.lock             # Dependencies lock file
├── R/
│   ├── app_server.R      # Server logic
│   ├── app_ui.R          # UI components
│   └── utils.R           # Utility functions
└── www/
    └── styles.css        # CSS styles
```

---

### 4. `report` — Generate HTML Report

Generates a comprehensive HTML report of validation findings.

#### Syntax

```bash
r-best-practices report <path> [options]
```

#### Arguments

- `path` — Project directory path (required)

#### Options

- `--output <path>` — Output directory for report (default: project directory)
- `--format <format>` — Output format: `text` (default), `json`
- `--quiet` — Suppress non-essential output

#### Examples

```bash
# Generate report in project directory
r-best-practices report .

# Save to specific directory
r-best-practices report /path/to/project --output ./reports

# JSON output with metadata
r-best-practices report . --format json

# Quiet mode (no output)
r-best-practices report . --quiet
```

#### Output

**Text Format:**
```
✓ Report generated: /home/user/my-project/validation-report.html
ℹ Open in browser to view interactive report
```

**HTML Report Features:**
- Professional styled report
- Project metadata (workflow, confidence, timing)
- Findings organized by severity
- Interactive categorization
- Responsive design (mobile-friendly)
- Print-friendly layout

---

## Configuration

### Configuration Files

The CLI looks for configuration files in the following order:

1. `.r-best-practicesrc` (JSON or JavaScript)
2. `.r-best-practicesrc.json`
3. `r-best-practices.config.json`

### Configuration Example

**`.r-best-practicesrc` (JSON):**
```json
{
  "format": "json",
  "output": "./validation-reports",
  "watch": false,
  "verbose": false,
  "quiet": false,
  "severity": "important",
  "category": "testing"
}
```

**`.r-best-practicesrc.js` (JavaScript):**
```javascript
module.exports = {
  format: 'json',
  output: './reports',
  author: 'My Team',
  email: 'team@example.com',
  verbose: process.env.NODE_ENV === 'development',
};
```

### Configuration Priority

1. Command-line options (highest priority)
2. Configuration file
3. Default values (lowest priority)

Example:
```bash
# Configuration file has format: json
# But --format text on command line overrides it
r-best-practices detect . --format text
```

---

## Watch Mode

Continuous validation with automatic re-run on file changes.

### Enabling Watch Mode

```bash
r-best-practices validate . --watch
```

### Features

- **Automatic re-validation** on R file changes
- **Live feedback** with timestamps
- **File change notifications** showing which file changed
- **Persistent display** of validation results
- **Stop with Ctrl+C**

### Example Output

```
ℹ Watching /home/user/my-project for changes...
⚠ Press Ctrl+C to stop

ℹ Running initial validation...
ℹ Project validation completed

[14:32:10] File changed: R/app_server.R
ℹ Re-validating project...

✓ Validation passed (no critical issues)

[14:33:45] File changed: R/utils.R
ℹ Re-validating project...

⚠ Found 1 important issue:
  • Missing docstring in utility function
```

---

## Output Formats

### Text (Default)

Human-readable output with colors and formatting.

```bash
r-best-practices validate . --format text
```

### JSON

Machine-readable format for automation and scripting.

```bash
r-best-practices validate . --format json
```

Example output:
```json
{
  "error": false,
  "data": {
    "workflow": "package",
    "findings": [
      {
        "id": "pkg-license",
        "severity": "critical",
        "category": "structure",
        "message": "Missing LICENSE file",
        "suggestions": ["Add a LICENSE file"]
      }
    ],
    "duration": 234
  },
  "timestamp": 1695830400000
}
```

### HTML

Interactive web-based report (report command only).

```bash
r-best-practices report . --format html
```

---

## Scripting & Automation

### Exit Codes

- `0` — Success (no critical issues)
- `1` — Validation failed (critical issues found) or error occurred

### JSON for Parsing

```bash
# Get JSON output and parse with jq
r-best-practices validate . --format json | jq '.data.findings[] | select(.severity == "critical")'

# Count findings by severity
r-best-practices validate . --format json | jq '.data.findings | group_by(.severity) | map({severity: .[0].severity, count: length})'
```

### CI/CD Integration

**GitHub Actions:**
```yaml
- name: Validate R Project
  run: |
    npm install -g r-best-practices-mcp
    r-best-practices validate . --format json > validation.json
    
- name: Report Results
  if: always()
  run: cat validation.json | jq '.data.findings'
```

**GitLab CI:**
```yaml
validate_r_project:
  script:
    - npm install -g r-best-practices-mcp
    - r-best-practices validate . --format json
  artifacts:
    reports:
      junit: validation.json
```

---

## Troubleshooting

### Command Not Found

```bash
# Ensure package is installed globally
npm list -g r-best-practices-mcp

# If not, install it
npm install -g r-best-practices-mcp

# Test installation
r-best-practices version
```

### Permission Denied (Linux/Mac)

```bash
# Make CLI executable
chmod +x /usr/local/bin/r-best-practices

# Or reinstall globally
npm uninstall -g r-best-practices-mcp
npm install -g r-best-practices-mcp
```

### Invalid Path Error

```bash
# Ensure path exists
ls -la /path/to/project

# Use absolute path if relative doesn't work
r-best-practices detect $(pwd)/project
```

### Watch Mode Not Working

```bash
# Ensure project is not on network drive
# Some network file systems don't support file watching

# Check file descriptor limit (Linux)
ulimit -n  # Should be >= 1024
ulimit -n 4096  # Increase if needed
```

---

## Examples & Recipes

### Complete Project Setup

```bash
# 1. Generate new Shiny app
r-best-practices template shiny my-dashboard --author "Jane Doe"

# 2. Navigate to project
cd my-dashboard

# 3. Validate initial template
r-best-practices validate .

# 4. Start development with watch
r-best-practices validate . --watch
```

### Batch Validation

```bash
# Validate multiple projects
for project in ~/r-projects/*/; do
  echo "Validating $project..."
  r-best-practices validate "$project" --format json >> results.json
done
```

### Integration with Pre-commit Hook

**`.git/hooks/pre-commit`:**
```bash
#!/bin/bash
r-best-practices validate . --quiet
if [ $? -ne 0 ]; then
  echo "❌ Commit blocked: R best practices validation failed"
  echo "Run: r-best-practices validate . --watch"
  exit 1
fi
```

### Generate Reports for All Projects

```bash
# Generate HTML reports for portfolio
for project in ~/portfolio/*/; do
  echo "Generating report for $(basename $project)..."
  r-best-practices report "$project" --output ./reports
done
```

---

## Environment Variables

- `NO_COLOR` — Disable colored output (set to any value)
- `DEBUG` — Enable debug logging (set to `r-best-practices:*`)
- `R_BEST_PRACTICES_CONFIG` — Custom config file path

Example:
```bash
# No colors
NO_COLOR=1 r-best-practices detect .

# Debug mode
DEBUG=* r-best-practices validate .

# Custom config
R_BEST_PRACTICES_CONFIG=~/.r-best-practices r-best-practices detect .
```

---

## See Also

- [README.md](./README.md) — Project overview
- [SECURITY.md](./SECURITY.md) — Security information
- [API_VERSIONING.md](./API_VERSIONING.md) — REST API documentation
- [OPERATIONS_MONITORING.md](./OPERATIONS_MONITORING.md) — Operations guide

---

**Last Updated:** 2026-09-27  
**Version:** 0.3.0  
**Status:** Production Ready
