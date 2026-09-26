# R Best Practices Dashboard - User Guide

## Overview

The R Best Practices Dashboard is a comprehensive web-based UI for the R Best Practices MCP Server. It provides an intuitive interface to validate R projects, detect workflow types, generate project templates, and browse best practices.

**Access the dashboard at:** `http://localhost:3000/dashboard`

## Features

### 1. Validate Tab
The validation interface provides two main functions:

#### Validate Project
- **Purpose:** Analyze an entire R project against best practices
- **Inputs:**
  - Project Path: Full path to your R project directory
  - Workflow Type (optional): Auto-detects if not specified
- **Outputs:**
  - Summary statistics (Critical/Important/Recommended/Info counts)
  - Detailed findings table with:
    - Severity badge (color-coded)
    - Category badge
    - Full message and details
    - File location and line number
    - Suggestions for fixes
- **Filtering & Sorting:**
  - Filter by keyword
  - Sort by severity, category, or file

#### Validate File
- **Purpose:** Analyze a single R or Quarto file
- **Inputs:**
  - File Path: Full path to R/Quarto file
- **Outputs:**
  - Same detailed findings as project validation
  - Focused on single-file issues

### 2. Detect Tab
The workflow detection interface identifies the type of R project automatically.

#### Features
- **Input:** Project directory path
- **Output:**
  - Detected workflow type (r-script, quarto, shiny, package, rmarkdown, renv, targets, plumber, analysis)
  - Confidence level (0-100%) with visual progress bar
  - List of detected indicators that led to the classification

#### Supported Workflows
| Workflow | Indicators | Example |
|----------|-----------|---------|
| **r-script** | Standalone .R files | `script.R`, `analysis.R` |
| **quarto** | `.qmd` files | `report.qmd`, `slides.qmd` |
| **shiny** | `app.R`, `ui.R`, `server.R` | Shiny applications |
| **package** | `DESCRIPTION`, `NAMESPACE` files | R packages |
| **rmarkdown** | `.Rmd` files | R Markdown documents |
| **renv** | `renv.lock` file | Projects with locked dependencies |
| **targets** | `_targets.R` file | Targets pipeline projects |
| **plumber** | `plumb.R`, API route definitions | REST API servers |
| **analysis** | Multiple R files in analysis directory | Research/statistical analysis |

### 3. Generate Tab
The template generator creates scaffold projects for any R workflow.

#### Features
- **Workflow Selection:**
  - Click to select from 9 workflow types
  - Visual icons for each workflow type
  - Each type creates workflow-specific boilerplate

- **Project Configuration:**
  - Project Name: Custom name for your project
  - Author Name: Your name (for DESCRIPTION, comments, etc.)
  - Author Email: Your email (for metadata)

- **Output:**
  - Complete project structure preview
  - List of generated files with content previews
  - Download button to export template as JSON

#### Generated Contents
Each template includes:
- Appropriate directory structure
- Essential configuration files (DESCRIPTION, _targets.R, etc.)
- Example code files
- Documentation templates
- License and gitignore files

**Example:** Selecting "Package" generates:
```
my-awesome-package/
├── DESCRIPTION
├── NAMESPACE
├── R/
│   └── main.R
├── man/
│   └── my-awesome-package.Rd
├── tests/
│   └── testthat/
│       └── test-main.R
├── .gitignore
└── LICENSE
```

### 4. Practices Tab
Browse and search the R best practices knowledge base.

#### Features
- **Filtering Options:**
  - By Workflow Type (r-script, quarto, shiny, etc.)
  - By Category (structure, naming, documentation, performance, security, testing, dependency, style)
  - Combine filters for targeted results

- **Practice Details:**
  - Title and severity level
  - Category badge
  - Detailed description
  - Code examples
  - Workflow applicability

#### Categories Explained
- **Structure:** Project organization, file layout, naming conventions
- **Naming:** Variable names, function names, file naming
- **Documentation:** Comments, docstrings, README files
- **Performance:** Optimization, memory usage, speed
- **Security:** Input validation, secure coding practices
- **Testing:** Unit tests, test coverage, test structure
- **Dependency:** Package management, version constraints
- **Style:** Code formatting, indentation, spacing

## UI Components

### Severity Badges
Color-coded badges indicate the importance of findings:

| Severity | Color | Meaning |
|----------|-------|---------|
| **Critical** | Red | Must be fixed; breaks best practices |
| **Important** | Orange | Should be fixed; significant issues |
| **Recommended** | Yellow | Nice to have; improves code quality |
| **Info** | Blue | Informational; suggestions |

### Category Badges
Indicate what type of issue was found (structure, naming, documentation, etc.)

### Confidence Bar
Visual progress bar showing how confident the workflow detection is:
- **Green (80-100%):** High confidence in detection
- **Yellow (50-79%):** Medium confidence; verify if correct
- **Orange (<50%):** Low confidence; may need manual review

### Statistics Cards
Summary boxes at the top of validation results showing:
- Count of each severity level
- Quick overview of project health

## API Integration

The dashboard communicates with the backend API via REST endpoints:

```
POST /api/detect-workflow         → Detect workflow type
POST /api/validate-project        → Validate entire project
POST /api/validate-file           → Validate single file
POST /api/generate-template       → Generate template
GET  /api/practices              → List practices (with filters)
GET  /api/practice/:id           → Get practice details
GET  /api/tools                  → List all available tools
GET  /health                     → Server health check
GET  /metrics                    → Performance metrics
GET  /metrics/requests.csv       → Export request metrics
GET  /metrics/operations.csv     → Export operation metrics
```

## Usage Examples

### Example 1: Validate an R Package

1. Click **Validate** tab
2. In "Validate Project" section:
   - Enter: `/path/to/my-package`
   - Leave Workflow Type as "Auto-detect"
3. Click **Validate Project**
4. Review findings:
   - Check Critical items first
   - Click Suggestions for fixes
   - Use sorting to group by category

### Example 2: Create a New Shiny App

1. Click **Generate** tab
2. Click the "Shiny" workflow option
3. Fill in:
   - Project Name: `my-interactive-app`
   - Author Name: `Your Name`
   - Author Email: `you@example.com`
4. Click **Generate Template**
5. Review the generated file structure
6. Click **Download Template** to save

### Example 3: Check File-Level Issues

1. Click **Validate** tab
2. In "Validate File" section:
   - Enter: `/path/to/analysis.R`
3. Click **Validate File**
4. Review file-specific findings

### Example 4: Explore Best Practices

1. Click **Practices** tab
2. Filter by:
   - Workflow: "package"
   - Category: "testing"
3. Click **Load Practices**
4. Review practices with examples
5. Click category or severity links for related practices

## Configuration

### Server Configuration
The dashboard server runs on configurable port (default: 3000):

```bash
# Start with default port 3000
npm run start:web

# Start with custom port
PORT=8080 npm run start:web
```

### API Base URL
The dashboard automatically uses the current origin as the API base URL. For development:
- Dashboard: `http://localhost:3000/dashboard`
- API: `http://localhost:3000/api/*`

For production, update the API_BASE constant in the dashboard HTML if needed.

## Performance Tips

### Large Projects
For projects with many files:
1. Validate specific files first to identify problem areas
2. Use category filtering to focus on specific issues
3. Set maxFindings limit in API to reduce results

### Slow Detection
Detection may be slow for very large directories:
1. Check if project has node_modules or similar large folders
2. Try detecting a subdirectory instead
3. Use specific workflow type if known

### Template Generation
Templates are generated quickly (<10ms):
- All 9 workflows can be generated instantly
- Download as JSON for offline use
- Customize generated files before using

## Troubleshooting

### "Directory not found"
- Verify the full path is correct
- Ensure path exists and is accessible
- Use absolute paths, not relative

### "No findings detected"
- This is actually a good sign!
- Your project meets the best practices
- Check that the correct directory was analyzed

### "Low confidence detection"
- The server couldn't confidently identify workflow type
- Manually specify workflow type in validation
- Check for workflow-specific indicator files

### "API connection failed"
- Ensure the web server is running
- Check that port 3000 (or configured port) is open
- Verify server is reachable at http://localhost:3000

### Dashboard styling issues
- Clear browser cache (Ctrl+Shift+Delete)
- Try a different browser
- Check browser console for errors (F12)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Move between inputs |
| `Enter` | Submit form (when focused on input) |
| `Ctrl+A` | Select all text in filter |

## Accessibility

The dashboard is designed with accessibility in mind:

- Semantic HTML structure
- ARIA labels for form elements
- Color-independent severity indicators (text labels)
- Keyboard navigation support
- Sufficient color contrast ratios
- Large touch targets for buttons (min 44px)

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Required features:**
- ES6 JavaScript (async/await)
- Fetch API
- CSS Grid and Flexbox
- CSS Variables

## Advanced Features

### Metrics Endpoint
View performance metrics of the server:

```bash
curl http://localhost:3000/metrics | jq .
```

Returns:
- Uptime
- Average request duration
- Total requests
- Operation counts (by type)
- Error counts

### CSV Export
Export request metrics:

```bash
curl http://localhost:3000/metrics/requests.csv > requests.csv
curl http://localhost:3000/metrics/operations.csv > operations.csv
```

### Health Check
Monitor server health:

```bash
curl http://localhost:3000/health | jq .
```

## Contributing

To customize the dashboard:

1. **Dashboard HTML:** `/src/public/dashboard.html`
   - Modify layout, sections, styling
   - Add new tabs or features
   - Customize colors and branding

2. **Web Server:** `/src/web-server.ts`
   - Add new API endpoints
   - Modify response formats
   - Adjust middleware

3. **Build:** 
   ```bash
   npm run build
   ```

4. **Test:**
   ```bash
   npm run start:web
   # Visit http://localhost:3000/dashboard
   ```

## Related Documentation

- [Architecture Guide](/CLAUDE.md) - System design and components
- [API Reference](/docs/api.md) - Detailed endpoint documentation
- [Best Practices](/docs/practices.md) - Complete practices guide
- [Development Guide](/docs/development.md) - Contributing and extending

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review API logs at `http://localhost:3000/health`
3. Check browser console (F12) for client-side errors
4. Review server logs for backend errors
