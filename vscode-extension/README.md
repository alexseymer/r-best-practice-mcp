# R Best Practices VS Code Extension

Professional R development support directly in VS Code with real-time validation, workflow detection, and template generation.

## Features

### 🔍 Workflow Detection
- Automatically detects your R project type (script, package, Shiny, Quarto, etc.)
- Shows confidence level and detection indicators
- Helps you follow the right best practices for your workflow

### ✅ Real-time Validation
- Validates projects against 52+ best practices
- Configurable severity levels (critical, important, recommended, info)
- Category-based filtering
- Auto-validation on file save
- File-specific validation

### 📋 Project Templates
- Generate complete project scaffolds for 9 workflow types
- Includes all necessary files and directory structure
- Pre-configured for best practices
- Supports custom author information

### 📊 Interactive Reports
- Beautiful HTML reports with findings breakdown
- Severity summary statistics
- Suggestion-based improvements
- Dark mode support

### ⚙️ Configuration
- Control auto-validation behavior
- Filter by severity and category
- Customize server connection settings
- Enable/disable code actions

## Installation

1. Install from VS Code Extension Marketplace: Search for "R Best Practices"
2. Or install from command line:
   ```bash
   code --install-extension alexseymer.r-best-practices
   ```

## Quick Start

### 1. Open an R Project

```bash
code /path/to/r-project
```

### 2. Run Workflow Detection

Press `Ctrl+Shift+P` and search for **R Best Practices: Detect Workflow**

The extension will identify your project type and confidence level.

### 3. Validate Your Project

Press `Ctrl+Shift+P` and search for **R Best Practices: Validate Project**

The extension will run validation and display findings inline as diagnostics.

### 4. Generate a Template

Press `Ctrl+Shift+P` and search for **R Best Practices: Generate Template**

Select your workflow type and follow the prompts to create a new project scaffold.

### 5. View Report

Press `Ctrl+Shift+P` and search for **R Best Practices: Show Report**

A beautiful HTML report will open showing all findings with suggestions.

## Commands

| Command | Keyboard | Description |
|---------|----------|-------------|
| `Detect Workflow` | — | Identify your R project type |
| `Validate Project` | `Shift+Alt+V` (Cmd+Shift+Alt+V on Mac) | Run project validation |
| `Validate File` | `Shift+Alt+F` (Cmd+Shift+Alt+F on Mac) | Validate current file |
| `Generate Template` | — | Create new project scaffold |
| `Show Report` | — | Display HTML validation report |
| `Toggle Auto-Validation` | — | Enable/disable auto-validation on save |

## Settings

### `r-best-practices.autoValidate`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Automatically validate on file save

### `r-best-practices.severity`
- **Type**: `string`
- **Default**: `recommended`
- **Options**: `critical`, `important`, `recommended`, `info`
- **Description**: Minimum severity level to display

### `r-best-practices.categories`
- **Type**: `array`
- **Default**: `[]` (all categories)
- **Options**: `structure`, `naming`, `documentation`, `security`, `testing`, `performance`, `dependency`, `style`
- **Description**: Filter findings by category (empty = all categories)

### `r-best-practices.enableCodeActions`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable quick fixes for issues

### `r-best-practices.showNotifications`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Show info/warning notifications for validation results

### `r-best-practices.serverPath`
- **Type**: `string`
- **Default**: `localhost:3000`
- **Description**: Path to R Best Practices server (HTTP URL or host:port)

## Supported Workflows

The extension supports validation and template generation for these R workflows:

1. **r-script** — Simple R scripts
2. **package** — R packages
3. **shiny** — Shiny web applications
4. **quarto** — Quarto documents
5. **rmarkdown** — R Markdown documents
6. **analysis** — Statistical analyses
7. **renv** — Projects using renv
8. **targets** — {targets} pipelines
9. **plumber** — Plumber REST APIs

## Configuration Examples

### Validate Only Critical Issues

```json
{
  "r-best-practices.severity": "critical"
}
```

### Disable Auto-Validation

```json
{
  "r-best-practices.autoValidate": false
}
```

### Focus on Testing and Documentation

```json
{
  "r-best-practices.categories": ["testing", "documentation"]
}
```

### Remote Server

```json
{
  "r-best-practices.serverPath": "http://validation.example.com:3000"
}
```

## Diagnostics Display

Findings are displayed as inline diagnostics in VS Code:

- **Critical** (🔴) — Errors that must be fixed
- **Important** (🟠) — Warnings about significant issues
- **Recommended** (🟡) — Suggestions for improvements
- **Info** (🔵) — Informational messages

Hover over the diagnostic icon to see the full message and suggestions.

## Troubleshooting

### Extension won't activate

**Error**: "Failed to connect to R Best Practices server"

**Solution**:
1. Verify the server is running: `curl http://localhost:3000/health`
2. Check `r-best-practices.serverPath` setting
3. Ensure the server is accessible from VS Code
4. Check the Output channel for more details

### No diagnostics showing

**Problem**: Diagnostics aren't appearing inline

**Solution**:
1. Run validation manually: `Cmd+Shift+V` (or `Shift+Alt+V`)
2. Check your severity and category filters
3. Ensure `autoValidate` is enabled
4. Review the Output channel for errors
5. Try opening a file and saving it to trigger validation

### Validation is slow

**Problem**: Validation takes too long

**Solution**:
1. Reduce project scope (validate smaller directories)
2. Exclude large folders in `.r-best-practicesrc`
3. Decrease update frequency by disabling auto-validation
4. Check server performance at `http://localhost:3000/metrics`

## Extension Compatibility

- **VS Code**: 1.60.0 or later
- **Node.js**: 14.x or later
- **Operating Systems**: Windows, macOS, Linux

## Performance

- **Workflow detection**: ~50-100ms
- **Project validation**: ~100-500ms (depends on project size)
- **Template generation**: <10ms
- **Real-time diagnostics**: Updates on file save

## Security

- No code is sent to external services (server must be local or trusted)
- Configuration stored locally in VS Code settings
- No telemetry or usage tracking
- All communication is HTTP (use HTTPS proxy if needed)

## Development

### Building from Source

```bash
cd vscode-extension
npm install
npm run compile
npm run package
```

### Running Tests

```bash
npm test
```

### Local Development

```bash
npm install
npm run watch
# In VS Code: Press F5 to open Extension Development Host
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update tests
5. Submit a pull request

## License

MIT © 2026 Alexander Seymer

## Related

- [R Best Practices CLI](../CLI_GUIDE.md) — Command-line interface
- [R Best Practices Server](../README.md) — Core server documentation
- [Security Guide](../SECURITY.md) — Security configuration
- [API Documentation](../API_VERSIONING.md) — REST API reference

## Support

For issues, questions, or feature requests:
- 📋 [GitHub Issues](https://github.com/alexseymer/r-best-practices-mcp/issues)
- 📧 Email: alexseymer@gmail.com
- 🌐 Website: r-best-practice-mcp.seymer.at

---

**Last Updated**: 2026-09-28  
**Version**: 0.3.0  
**Status**: Production Ready
