# RStudio Addin Setup Tutorial

Install and use the R Best Practices RStudio addin for in-IDE validation.

## Prerequisites

- RStudio 1.3 or later
- R 3.6 or later
- MCP server running (required for communication)

## Installation

### From GitHub

```r
# Install from GitHub
devtools::install_github(\"alexseymer/r-best-practice-mcp\",
                        subdir = \"rstudio-addin\")
```

### From Local Source

```r
# If you have the repository cloned
devtools::install_local(\"path/to/rstudio-addin\")
```

## Starting the MCP Server

The RStudio addin communicates with the MCP server via JSON-RPC. Start it in a background process:

```bash
# In terminal
node /path/to/dist/index.js
```

Or configure it to run automatically:

```r
# In RStudio console
# (optional - set this in .Rprofile)
```

## Accessing the Addins

Once installed, find the addins in RStudio:

1. Click **Addins** menu (top bar)
2. Look for **R Best Practices** section
3. Choose from 4 available addins

## The 4 Addins

### 1. Validate Project

**What it does:** Validates your current R project against 52+ best practices.

**How to use:**
1. Click Addins → Validate Project
2. A dialog opens with 3 tabs

**Tabs:**
- **Validation** - Shows spinning loader while validating
- **Findings** - Table of all issues with severity/category
- **Statistics** - Summary counts by severity level

**Output:**
```
Critical: 2 | Important: 5 | Recommended: 8 | Info: 3
Total: 18 findings | Duration: 245ms
```

Click on findings to see details and suggestions.

### 2. Detect Workflow

**What it does:** Automatically identifies your R project's workflow type.

**How to use:**
1. Click Addins → Detect Workflow
2. Dialog shows results instantly

**Output:**
```
Type: package
Confidence: 95%
Indicators: DESCRIPTION, R/, tests/testthat/, man/
```

Helps understand what validation rules apply to your project.

### 3. Generate Template

**What it does:** Creates a new project scaffold.

**How to use:**
1. Click Addins → Generate Template
2. Configure in dialog:
   - **Workflow Type**: Select from dropdown (package, shiny, etc.)
   - **Project Name**: Name of your project
   - **Author Name** (optional): Your name
   - **Author Email** (optional): Your email
   - **Output Directory**: Where to create the project
3. Click "Generate Template"
4. Files are created and ready to use

**Workflows available:**
- r-script
- package
- shiny
- quarto
- rmarkdown
- renv
- targets
- plumber
- analysis

### 4. Show Report

**What it does:** Displays a comprehensive validation report.

**How to use:**
1. Click Addins → Show Report
2. A pane opens with styled report

**Report includes:**
- Visual statistics boxes (color-coded by severity)
- Full findings table
- Sortable and filterable
- "No issues found" message if clean

## Workflow Examples

### Workflow 1: Validate Your Package

```
1. Open RStudio project for your package
2. Click Addins → Validate Project
3. Review findings in the Findings tab
4. Click on each finding to see suggestions
5. Fix issues based on recommendations
6. Re-validate to confirm fixes
```

### Workflow 2: Generate New Project

```
1. Click Addins → Generate Template
2. Select "package" workflow
3. Enter "mypackage" as project name
4. Click "Generate Template"
5. New project created with structure:
   - DESCRIPTION
   - NAMESPACE
   - R/ folder
   - tests/ folder
   - README.md
   - LICENSE
6. Start adding your functions
```

### Workflow 3: Detect and Validate

```
1. Open existing project
2. Click Addins → Detect Workflow
3. See what type of project it is
4. Click Addins → Validate Project
5. Validation runs with appropriate rules
6. Review suggestions specific to workflow
```

### Workflow 4: Generate Report

```
1. After validating, click Addins → Show Report
2. View summary statistics
3. See all findings in organized table
4. Share report with team or keep for records
```

## Best Practices with RStudio Addin

### 1. Regular Validation

Validate your project regularly:
- After adding new functions
- Before committing to git
- During code review process
- When refactoring

### 2. Address Issues Progressively

Start with critical issues:
1. Fix all critical findings
2. Address important items
3. Handle recommended improvements
4. Consider info-level suggestions

### 3. Use for Template Generation

For new projects:
1. Generate template from addin
2. Customizes to your workflow
3. Starts with best practices built in
4. Saves time on setup

### 4. Share Reports

Generate reports for:
- Code review discussions
- Team documentation
- Onboarding new developers
- CI/CD documentation

## Troubleshooting

### Addin Not Appearing

1. **Verify installation:**
```r
library(rBestPractices)
```

2. **Restart RStudio** (Session → Restart R)

3. **Check installation:**
```r
find.package(\"rBestPractices\")
```

### MCP Server Connection Error

If you see "MCP server not responding":

1. Verify server is running:
```bash
ps aux | grep \"node\"
```

2. Start server if needed:
```bash
node /path/to/dist/index.js &
```

3. Check server port (default: stdin/stdout)

### Report Not Displaying

1. Verify internet connection (for rendering)
2. Check browser compatibility
3. Try View → Pane → Show in Viewer

### Timeout Errors

Increase timeout in R:
```r
options(timeout = 60)  # 60 seconds
```

## Performance Tips

1. **Run validation in off-peak times** for large projects
2. **Use template generation** to start with best practices
3. **Focus on critical issues** first
4. **Watch mode** not available in addin; use CLI instead

## Integration with RStudio Workflow

### Project Setup

Use addin to generate templates → automatically follows best practices

### Development

Validate regularly as you code → catch issues early

### Code Review

Generate reports → share findings with reviewers

### Publication

Final validation before submitting packages → ensure quality

## Related Documentation

- [R Best Practices Guide](../best-practices-by-workflow.md)
- [CLI Quick Start](02-cli-quickstart.md)
- [MCP Integration Guide](01-mcp-integration.md)

## Next Steps

1. Generate a template project to see structure
2. Validate an existing project
3. Review findings and understand suggestions
4. Make improvements based on recommendations
5. Share report with your team
