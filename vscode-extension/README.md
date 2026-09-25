# R Best Practices - VS Code Extension

Real-time R development best practices validation and assistance directly in VS Code.

## Features

### 🔍 Real-Time Validation
- Automatic validation on file save or as you type
- Detects issues across all 9 R workflow types
- Shows findings with severity levels (critical, important, recommended, info)

### 📊 Workflow Detection
- Automatically identifies your project type (package, Shiny app, analysis, etc.)
- Displays confidence score and detected indicators
- Helps you use the right best practices for your workflow

### 🎯 Quick Fixes
- Inline suggestions for common issues
- One-click fixes for applicable problems
- Code actions for rapid resolution

### 📋 Project Reports
- Generate comprehensive HTML reports
- Visual summary of all findings
- Organized by severity and category
- Perfect for sharing with team members

### 🎨 Template Generation
- Generate complete project scaffolds within VS Code
- Supports all 9 workflow types
- Customizable project name, author, and email
- Opens generated project in new VS Code window

## Installation

1. Install from VS Code Extension Marketplace (coming soon)
2. Or install from file: `vsce package` and then install the `.vsix` file

## Configuration

Configure R Best Practices in VS Code settings:

```json
{
  "r-practices.enabled": true,
  "r-practices.validateOnSave": true,
  "r-practices.validateOnOpen": false,
  "r-practices.minSeverity": "recommended",
  "r-practices.maxFindings": 50,
  "r-practices.serverPath": "r-practices"
}
```

### Options

- **enabled** — Enable/disable the extension
- **validateOnSave** — Validate project when files are saved
- **validateOnOpen** — Validate when workspace opens (slower)
- **minSeverity** — Minimum severity level to show (critical, important, recommended, info)
- **maxFindings** — Maximum number of findings to display
- **serverPath** — Path to r-practices CLI tool (default: "r-practices")

## Usage

### Keyboard Shortcuts

- **Shift+Alt+V** — Validate current project

### Commands

Access via Command Palette (Ctrl/Cmd+Shift+P):

- **R Practices: Validate Project** — Run full project validation
- **R Practices: Detect Workflow Type** — Identify your project type
- **R Practices: Generate Template** — Create new project scaffold
- **R Practices: Show Report** — Open HTML validation report
- **R Practices: Quick Fix** — Apply suggested fix to issue

## Workflow Support

The extension validates projects for:

| Workflow | Description |
|----------|-------------|
| **r-script** | Standalone R scripts |
| **quarto** | Quarto documents for reproducible analysis |
| **shiny** | Interactive web applications |
| **package** | R packages for distribution |
| **rmarkdown** | R Markdown reports |
| **renv** | Projects with renv dependency management |
| **targets** | Pipeline-based workflows |
| **plumber** | REST APIs in R |
| **analysis** | Data analysis projects |

## Features in Action

### Validation On Save
Changes are validated automatically when you save files. Issues appear in the Problems panel.

### Inline Diagnostics
Issues are shown inline with color-coded severity:
- 🔴 **Critical** — Errors that must be fixed
- 🟠 **Important** — Should be addressed soon
- 🟡 **Recommended** — Best practices worth following
- 🔵 **Info** — Additional guidance

### Quick Fixes
Click the lightbulb icon to apply suggested fixes.

### HTML Reports
Generate shareable HTML reports with visual summaries, perfect for code reviews.

## Requirements

- VS Code 1.80+
- Node.js 16+
- R Best Practices CLI tool (`npm install -g r-practices`)

## Troubleshooting

### Extension not activating
- Ensure you have `.R`, `.Rmd`, or `.qmd` files in your project
- Check that R Best Practices CLI is installed: `r-practices --version`

### No validation results
- Check extension settings: `r-practices.enabled` should be `true`
- Run "R Practices: Validate Project" from command palette
- Check Output panel for error messages

### Slow validation
- Increase the timeout in extension settings
- Reduce `maxFindings` to limit results
- Disable `validateOnOpen` if not needed

## Support

- **Issues**: [GitHub Issues](https://github.com/alexseymer/r-best-practice-mcp/issues)
- **Questions**: [GitHub Discussions](https://github.com/alexseymer/r-best-practice-mcp/discussions)

## License

MIT License
