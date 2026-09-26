# VS Code Extension Setup Tutorial

Install and configure the R Best Practices VS Code extension.

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "R Best Practices"
4. Click Install

### Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/alexseymer/r-best-practice-mcp.git
cd r-best-practice-mcp/vscode-extension
```

2. Install dependencies:
```bash
npm install
```

3. Link the extension locally:
```bash
ln -s $(pwd) ~/.vscode/extensions/r-best-practices
```

4. Reload VS Code

## Configuration

### Settings

Open VS Code settings (Code → Preferences → Settings) and search for "r-practices":

**Key Settings:**

- `r-practices.severity` - Minimum severity to display (critical, important, recommended, info)
- `r-practices.validationOnSave` - Validate on file save (default: true)
- `r-practices.validationDelay` - Delay before validation (ms, default: 1000)
- `r-practices.showCodeActions` - Show quick fix suggestions (default: true)
- `r-practices.htmlReportPath` - Where to save HTML reports

### Keyboard Shortcuts

The extension binds Shift+Alt+V for quick validation. To customize:

1. Open Keyboard Shortcuts (Ctrl+K Ctrl+S)
2. Search for "r-practices"
3. Click the pencil icon to rebind

## Features

### Inline Diagnostics

As you edit R files, the extension shows validation issues:

```r
library(tidyverse)  # ← Hover to see best practice suggestions
```

Issues appear with color-coded severity:
- 🔴 **Red** - Critical
- 🟠 **Orange** - Important
- 🟡 **Yellow** - Recommended
- 🔵 **Blue** - Info

### Quick Fixes

Click on a diagnostic to see suggested fixes:

```r
library(tidyverse)
```

Press `Ctrl+.` (Cmd+.) to view quick fixes for that line.

### Command Palette Integration

Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P) and search:

- `R Best Practices: Validate Project`
- `R Best Practices: Detect Workflow`
- `R Best Practices: Generate Template`
- `R Best Practices: Show Report`

### Workflow Detection

Right-click on your project folder → "Detect R Workflow":

Shows:
- Detected workflow type
- Confidence percentage
- Detected indicators (files/directories)

### HTML Reports

Generate a formatted HTML report:

1. Command Palette → "R Best Practices: Show Report"
2. Or configure auto-generation on save

The report shows:
- Summary statistics
- All findings with details
- Actionable suggestions
- Printable format

## Workflows in VS Code

### Workflow: Validate Current File

1. Open an R file
2. Press Shift+Alt+V
3. See diagnostics for that file

### Workflow: Project Validation

1. Open your project folder
2. Command Palette → "R Best Practices: Validate Project"
3. Diagnostics appear across all R files

### Workflow: Generate Template

1. Command Palette → "R Best Practices: Generate Template"
2. Select workflow type
3. Enter project name
4. Extension creates the project

### Workflow: View Detailed Report

1. Command Palette → "R Best Practices: Show Report"
2. Opens HTML report in new window
3. Review all findings
4. Print or save as PDF

## Troubleshooting

### Extension Not Activating

Verify it's active:
1. Open Command Palette
2. Search for "Extensions: Show Active"
3. Look for "r-practices"

If not showing:
1. Restart VS Code
2. Reinstall the extension

### Diagnostics Not Showing

1. Check settings - ensure severity filter allows your issues
2. Verify R files are recognized (`.R` or `.r` extension)
3. Check Output panel (Ctrl+Shift+U) for errors

### Slow Validation

Increase `validationDelay` to reduce frequency:
1. Settings → r-practices.validationDelay
2. Increase value (e.g., 2000 for 2 seconds)

### Report Not Opening

1. Check browser compatibility
2. Verify write permissions to report directory
3. Try specifying full path in settings

## Performance Tips

1. **Disable on save validation** if working with large projects
2. **Filter by severity** to reduce clutter
3. **Use watch mode** from CLI for continuous monitoring
4. **Run validation on demand** instead of on every save

## Integration with VS Code Features

### Multi-root Workspaces

The extension works with VS Code multi-root workspaces. Each folder gets validated independently.

### Source Control Integration

Works with Git, GitHub, etc. Diagnostics persist across version control operations.

### Remote Development

Supported on VS Code Remote SSH, Containers, etc.

## Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| Shift+Alt+V | Validate current project |
| Ctrl+Shift+P | Command Palette |
| Ctrl+. | Quick fixes for line |
| Ctrl+K Ctrl+S | Keyboard Shortcuts settings |

## Next Steps

- Review the example projects
- Check out CLI for batch validation
- Read the best practices guide for your workflow
- Set up automated validation with CI/CD
