# MCP Server Integration Guide

Learn how to integrate the R Best Practices MCP server with Claude and other MCP clients.

## What is MCP?

The Model Context Protocol (MCP) enables Claude to access external tools and data through a standardized interface. The R Best Practices MCP server exposes 6 tools for validating R projects.

## Prerequisites

- Node.js 20+ installed
- npm or yarn
- Basic understanding of MCP

## Installation

1. Clone the repository:
```bash
git clone https://github.com/alexseymer/r-best-practice-mcp.git
cd r-best-practice-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Starting the MCP Server

```bash
node dist/index.js
```

The server will start listening on stdin/stdout for MCP protocol messages.

## Available Tools

### 1. detect_workflow
Identifies the R project workflow type.

**Input:**
```json
{ "path": "/path/to/project" }
```

**Output:**
```json
{
  "workflow": "package",
  "confidence": 95,
  "indicators": ["DESCRIPTION", "R/", "tests/testthat/"]
}
```

### 2. validate_project
Checks a project against best practices.

**Input:**
```json
{
  "path": "/path/to/project",
  "workflow": "auto",
  "options": {
    "limit": 100,
    "severity": "critical",
    "category": null
  }
}
```

### 3. validate_file
Validates a single R file.

**Input:**
```json
{ "path": "/path/to/file.R" }
```

### 4. generate_template
Creates a project scaffold.

**Input:**
```json
{
  "workflow": "shiny",
  "options": {
    "projectName": "my-app",
    "author": "John Doe",
    "email": "john@example.com"
  }
}
```

### 5. get_practice
Gets details about a best practice.

**Input:**
```json
{ "id": "pkg-roxygen" }
```

### 6. list_practices
Lists practices with filtering.

**Input:**
```json
{
  "workflow": "package",
  "category": "documentation"
}
```

## Integration with Claude

To use with Claude:

1. Configure MCP in your Claude settings
2. Point to the server: `node /path/to/dist/index.js`
3. Claude can now call any of the 6 tools

## Example Workflow

```
User: Validate my R package
  ↓
Claude calls detect_workflow with package path
  ↓
Server returns: workflow = "package"
  ↓
Claude calls validate_project with workflow
  ↓
Server returns: findings with best practice issues
  ↓
Claude displays findings and suggests improvements
```

## Error Handling

All tools return consistent error responses:

```json
{
  "error": {
    "code": "INVALID_PATH",
    "message": "Path does not exist: /invalid/path"
  }
}
```

Common error codes:
- `INVALID_PATH` - Path doesn't exist
- `INVALID_WORKFLOW` - Unknown workflow type
- `VALIDATION_ERROR` - Input validation failed
- `INTERNAL_ERROR` - Server error

## Troubleshooting

**Server not responding:**
- Verify Node.js is installed: `node --version`
- Check stdin/stdout configuration
- Review error logs

**Tool calls failing:**
- Verify paths are absolute
- Check file permissions
- Review input schema

## Next Steps

- Try the CLI tool for testing
- Explore different workflows
- Review best practices for your workflow
- Check out the VS Code extension for IDE integration
