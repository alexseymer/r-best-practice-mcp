# R Best Practices MCP Server - Architecture Guide

**Last Updated**: 2026-09-26

## System Overview

The R Best Practices MCP Server is a comprehensive system for enforcing R development best practices across different project types. It provides workflow detection, project validation, template generation, and knowledge base access through multiple interfaces.

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    MCP Protocol Layer                          │
│  (stdio transport, tool definitions, error handling)           │
└────────────────┬─────────────────────────────────────────────┘
                 │
        ┌────────┴──────────┐
        ▼                   ▼
    ┌─────────┐         ┌──────────┐
    │ MCP     │         │ HTTP/REST│
    │ Server  │         │ API      │
    │(Node)   │         │ (Express)│
    └────┬────┘         └────┬─────┘
         │                   │
    ┌────┴───────────────────┴────┐
    ▼                             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │            Core Engine Layer                                │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
    │  │Detector  │  │Validator │  │Template  │  │Knowledge │    │
    │  │          │  │          │  │Generator │  │Base      │    │
    │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
    └────┬─────────────────────────────────────────────────────┬─┘
         │                                                       │
    ┌────┴────────┐                                   ┌────────┴──┐
    ▼             ▼                                   ▼           ▼
┌────────┐   ┌──────────┐                       ┌─────────┐ ┌────────┐
│Analysis│   │Utilities │                       │Logging  │ │Config  │
│Modules │   │(Files)   │                       │         │ │(Rules) │
└────────┘   └──────────┘                       └─────────┘ └────────┘
     │
     ├─ Complexity Analysis
     ├─ Dependency Tracking
     ├─ Performance Profiling
     └─ Auto-Fixes Engine
```

## Component Architecture

### 1. Workflow Detector (`src/engine/detector.ts`)

**Responsibility**: Identify R project types from directory structure

**Key Methods**:
```typescript
detect(path: string): Promise<DetectionResult>
```

**How It Works**:
1. Scans directory for workflow-specific files
2. Awards points for different indicators
3. Returns detected workflow with confidence percentage (0-100%)
4. Provides list of detected indicators (e.g., "DESCRIPTION", "app.R")

**Supported Workflows** (9 types):
- `r-script` — Standalone R scripts
- `quarto` — Quarto documents (.qmd)
- `shiny` — Shiny web applications
- `package` — R packages
- `rmarkdown` — R Markdown documents (.Rmd)
- `renv` — Projects with renv isolation
- `targets` — Pipelines using targets framework
- `plumber` — REST APIs with Plumber
- `analysis` — Data analysis projects

**Scoring System**:
```
High-confidence indicators (points):
- Package: DESCRIPTION (25), R/ (15), tests/ (15)
- Shiny: app.R (25), ui.R + server.R (20), rsconnect/ (10)
- Quarto: .qmd files (25), _quarto.yml (15)
...etc
Confidence = (points collected / max possible) × 100
```

**Performance**: ~50-100ms per detection

---

### 2. Validator Engine (`src/engine/validator.ts`)

**Responsibility**: Check projects against 52+ best practices

**Key Methods**:
```typescript
validateProject(path, workflow, options): Promise<ValidationResult>
validateFile(path): Promise<Finding[]>
```

**Architecture**:
```
Input: Project Path + Workflow Type
  │
  ├─→ Load workflow-specific rules
  ├─→ Execute checkers in parallel:
  │   ├─ Directory structure checks
  │   ├─ File format validation
  │   ├─ Configuration validation
  │   └─ Best practice checks
  └─→ Apply filters (severity, category, limit)
       │
       └─→ Output: Finding[]
```

**Finding Structure**:
```typescript
interface Finding {
  id: string                    // Unique identifier
  severity: Severity           // critical, important, recommended, info
  category: Category           // structure, naming, documentation, ...
  message: string             // User-friendly message
  suggestions?: string[]      // Actionable suggestions
  file?: string              // Optional: file path
  line?: number              // Optional: line number
}
```

**Validators by Workflow**:
- **R Script** — Headers, functions, global vars, naming
- **Quarto** — YAML frontmatter, code chunks, cache config
- **Shiny** — app.R structure, UI/server organization, reactivity
- **Package** — DESCRIPTION file, LICENSE, R/, tests/, documentation
- **R Markdown** — YAML headers, chunk options, output formats
- **renv** — renv.lock presence, versioning, isolation
- **targets** — _targets.R structure, naming conventions
- **Plumber** — Input validation, error handling, endpoints
- **Analysis** — Directory structure (data/, R/, output/)

**Performance**: ~100-500ms depending on project size

---

### 3. Template Generator (`src/engine/template-generator.ts`)

**Responsibility**: Create complete project scaffolds with example code

**Key Methods**:
```typescript
generate(workflow: Workflow, options: TemplateGeneratorOptions): GeneratedTemplate
```

**Generated Output**:
```typescript
interface GeneratedTemplate {
  workflow: Workflow
  files: Array<{ path: string, content: string }>
  directories: string[]
}
```

**Templates Include**:
- Directory structure (following best practices)
- Configuration files (DESCRIPTION, .Rprofile, renv.lock, etc.)
- Example code demonstrating best practices
- README.md with setup instructions
- .gitignore appropriate to workflow
- LICENSE file (MIT)
- Example test files (where applicable)

**Customization Options**:
```typescript
interface TemplateGeneratorOptions {
  projectName: string      // Project name
  authorName?: string      // Author name
  authorEmail?: string     // Author email
}
```

**Performance**: <10ms per template generation

---

### 4. Knowledge Base (`src/data/knowledge-base.ts`)

**Responsibility**: Store and query 52+ best practices

**Data Structure**:
```typescript
interface Practice {
  id: string                      // e.g., "pkg-roxygen2"
  title: string                   // Human-readable title
  workflow: Workflow              // Which workflow(s)
  category: Category              // Topic area
  severity: Severity              // Impact level
  description: string             // Detailed explanation
  examples: string[]              // Code examples
}
```

**Query Methods**:
```typescript
getPractice(id: string): Practice | undefined
listPractices(options: PracticeQueryOptions): PracticeQueryResult
searchPractices(query: string): PracticeQueryResult
```

**Organization** (52 total practices):
- **R Scripts** (7) — Headers, functions, naming
- **Quarto** (7) — YAML, chunks, caching
- **Shiny** (7) — Reactivity, validation, modules
- **Packages** (9) — roxygen2, testing, DESCRIPTION
- **R Markdown** (4) — YAML, chunks, options
- **renv** (4) — Init, lock, snapshot, restore
- **targets** (4) — Structure, naming, dependencies
- **Plumber** (6) — Endpoints, validation, responses
- **Analysis** (3) — Structure, documentation, versioning

**Indexing**:
- Primary: by ID (fast direct lookup)
- Secondary: by workflow (category filtering)

**Performance**: <5ms per query

---

### 5. Analysis Modules (`src/analysis/`)

**Responsibility**: Advanced code quality features

#### 5a. Complexity Analyzer (`complexity.ts`)
- **Metrics**: Cyclomatic complexity, nesting depth, function length
- **Output**: Complexity score (0-100%), improvement suggestions
- **Performance**: Linear in code size

#### 5b. Dependency Analyzer (`dependencies.ts`)
- **Sources**: library() calls, renv.lock, DESCRIPTION, imports
- **Analysis**: Unused dependencies, missing declarations, version conflicts
- **Output**: Dependency report with issues

#### 5c. Performance Profiler (`performance.ts`)
- **Measurement**: Operation timing, memory usage
- **Analysis**: Bottleneck identification, optimization suggestions
- **Output**: Performance report with recommendations

#### 5d. Auto-Fixes Engine (`auto-fixes.ts`)
- **Fixes**: roxygen2 documentation, import statements, formatting, style
- **Application**: Batch fixes with optional dry-run
- **Output**: Modified files with change summary

---

### 6. File Utilities (`src/utils/file.ts`)

**Responsibility**: Async file system operations

**Key Methods**:
```typescript
exists(path: string): Promise<boolean>
isDirectory(path: string): Promise<boolean>
readFile(path: string): Promise<string>
listFiles(dir: string, pattern?: string, recursive?: boolean): Promise<string[]>
```

**Features**:
- All async/await for non-blocking I/O
- Pattern-based file filtering (glob-style)
- Recursive directory traversal
- Hidden file handling
- Error handling with meaningful messages

---

### 7. Logger (`src/utils/logger.ts`)

**Responsibility**: Structured logging with levels

**Levels**: debug, info, warn, error

**Features**:
- Timestamps on all output
- Colored output (when TTY available)
- Configurable level filtering

---

## Data Flow Diagrams

### Detection Flow

```
Input: Project Path
  │
  ├─→ [WorkflowDetector]
  │   ├─→ Check for R files
  │   ├─→ Check for specific files (DESCRIPTION, app.R, etc.)
  │   ├─→ Check for directories (R/, tests/, etc.)
  │   ├─→ Calculate confidence score
  │   └─→ Return indicators
  │
Output: DetectionResult { workflow, confidence, indicators }
```

### Validation Flow

```
Input: Path + Workflow
  │
  ├─→ [Validator]
  │   ├─→ Load workflow-specific rules
  │   ├─→ Run all relevant checkers:
  │   │   ├─ Directory structure
  │   │   ├─ Required files
  │   │   ├─ File content validation
  │   │   ├─ Configuration validation
  │   │   └─ Best practice checks
  │   ├─→ Collect findings
  │   └─→ Apply filters (severity, category, limit)
  │
Output: ValidationResult { workflow, findings[], duration }
```

### Template Generation Flow

```
Input: Workflow + Options
  │
  ├─→ [TemplateGenerator]
  │   ├─→ Load workflow-specific template
  │   ├─→ Customize with project name, author, etc.
  │   ├─→ Generate files:
  │   │   ├─ DESCRIPTION / package.json / etc.
  │   │   ├─ Sample code files
  │   │   ├─ README.md
  │   │   ├─ .gitignore
  │   │   ├─ LICENSE
  │   │   └─ Example test files
  │   └─→ Create directory structure
  │
Output: GeneratedTemplate { workflow, files[], directories[] }
```

---

## API Architecture

### MCP Tools (6 total)

**Tool 1: `detect_workflow`**
```json
{
  "input": { "path": "/path/to/project" },
  "output": {
    "workflow": "package",
    "confidence": 95,
    "indicators": ["DESCRIPTION", "R/", "tests/"]
  }
}
```

**Tool 2: `validate_project`**
```json
{
  "input": {
    "path": "/path/to/project",
    "workflow": "package",
    "severities": ["critical", "important"],
    "limit": 50
  },
  "output": {
    "workflow": "package",
    "findings": [...],
    "duration": 145
  }
}
```

**Tool 3: `validate_file`**
```json
{
  "input": { "path": "/path/to/file.R" },
  "output": {
    "path": "/path/to/file.R",
    "findings": [...]
  }
}
```

**Tool 4: `generate_template`**
```json
{
  "input": {
    "workflow": "shiny",
    "projectName": "my-app",
    "authorName": "John Doe"
  },
  "output": {
    "workflow": "shiny",
    "files": [...],
    "directories": [...]
  }
}
```

**Tool 5: `get_practice`**
```json
{
  "input": { "id": "pkg-roxygen" },
  "output": {
    "id": "pkg-roxygen",
    "title": "Use roxygen2",
    "workflow": "package",
    "category": "documentation",
    "description": "...",
    "examples": [...]
  }
}
```

**Tool 6: `list_practices`**
```json
{
  "input": { "workflow": "package", "category": "documentation" },
  "output": {
    "practices": [...],
    "total": 52
  }
}
```

### HTTP REST API Endpoints

When running with Express web server or Docker:

```
GET  /health                          — Server health check
POST /api/detect-workflow             — Detect workflow
POST /api/validate-project            — Validate project
POST /api/validate-file               — Validate file
GET  /api/practice/:id                — Get practice details
GET  /api/practices                   — List practices
POST /api/generate-template           — Generate template
GET  /api/tools                       — List available tools
```

---

## Extension Points

### Adding a New Workflow Type

1. **Add type definition** (src/types/workflow.ts)
   ```typescript
   type Workflow = '...' | 'new-workflow'
   ```

2. **Add detection logic** (src/engine/detector.ts)
   ```typescript
   private async checkNewWorkflow(): Promise<{ score: number, indicators: string[] }> {
     // Check for workflow-specific files/patterns
   }
   ```

3. **Add validator** (src/engine/validator.ts)
   ```typescript
   private async validateNewWorkflow(path: string): Promise<Finding[]> {
     // Run checks specific to workflow
   }
   ```

4. **Add template** (src/engine/template-generator.ts)
   ```typescript
   private generateNewWorkflow(options: TemplateGeneratorOptions): GeneratedTemplate {
     // Return scaffold files and directories
   }
   ```

5. **Add practices** (src/data/knowledge-base.ts)
   ```typescript
   // Add 3-10 practices for the new workflow
   ```

6. **Add tests** (tests/unit/)
   ```typescript
   // Test detection, validation, and template generation
   ```

### Adding Custom Validation Rules

Edit `src/config/rules-engine.ts`:

```typescript
const customRules = [
  {
    id: 'custom-rule-id',
    workflow: 'package',
    category: 'documentation',
    severity: 'recommended',
    pattern: /pattern to match/,
    message: 'Custom rule message',
    suggestions: ['Fix suggestion 1', 'Fix suggestion 2'],
  },
  // ... more rules
]
```

---

## Deployment Architecture

### Option 1: MCP Server (for Claude)

```
┌──────────────────────────────────────┐
│  Claude or MCP Client Application    │
└─────────────┬────────────────────────┘
              │ stdio transport
              ▼
┌──────────────────────────────────────┐
│  MCP Server                          │
│  (node dist/index.js)                │
│  - Tool definitions                  │
│  - Tool handlers                     │
│  - Error handling                    │
└─────────────┬────────────────────────┘
              │
              ▼
      ┌──────────────────┐
      │ Core Engine      │
      │ (Detector,       │
      │  Validator,      │
      │  Generator)      │
      └──────────────────┘
```

### Option 2: HTTP REST API (Docker)

```
┌──────────────────────────────────┐
│  HTTP Client (curl, browser, etc)│
└─────────────┬────────────────────┘
              │ HTTP requests
              ▼
┌──────────────────────────────────┐
│  Express Web Server              │
│  (node dist/web-server-entry.js) │
│  - Port 3000                     │
│  - Health checks                 │
│  - Request routing               │
└─────────────┬────────────────────┘
              │
              ▼
      ┌──────────────────┐
      │ Core Engine      │
      │ (same as MCP)    │
      └──────────────────┘
```

### Option 3: Docker Container

```
┌──────────────────────────────────┐
│  Docker Image                    │
│  (alexseymer/r-best-practices)   │
│  - Node.js + npm                 │
│  - Pre-built dist/               │
│  - Health checks                 │
└─────────────┬────────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
  MCP Server        HTTP API (Express)
  (stdio)           (port 3000)
```

---

## Dependency Graph

```
src/server.ts (main MCP server)
  ├─→ src/engine/detector.ts
  ├─→ src/engine/validator.ts
  ├─→ src/engine/template-generator.ts
  ├─→ src/data/knowledge-base.ts
  ├─→ src/analysis/
  │   ├─→ complexity.ts
  │   ├─→ dependencies.ts
  │   ├─→ performance.ts
  │   └─→ auto-fixes.ts
  └─→ src/utils/
      ├─→ file.ts
      └─→ logger.ts

src/cli/index.ts (CLI interface)
  ├─→ src/engine/* (all engines)
  └─→ src/cli/commands/
      ├─→ detect.ts
      ├─→ validate.ts
      ├─→ template.ts
      └─→ report.ts
```

---

## Performance Characteristics

| Operation | Typical Time | Factors |
|-----------|--------------|---------|
| Detect workflow | 50-100ms | Directory size, number of files |
| Validate project | 100-500ms | Project size, number of checks |
| Validate file | 10-50ms | File size, complexity |
| Generate template | <10ms | Fixed overhead only |
| Knowledge base lookup | <5ms | In-memory hash table |
| Complexity analysis | ~500ms | Code size, nesting depth |
| Dependency analysis | 50-200ms | Number of dependencies |

---

## Type System

The system uses a comprehensive TypeScript type system:

```typescript
// Workflows (9 types)
type Workflow = 'r-script' | 'quarto' | 'shiny' | 'package' | 
                'rmarkdown' | 'renv' | 'targets' | 'plumber' | 'analysis'

// Severity (4 levels)
type Severity = 'critical' | 'important' | 'recommended' | 'info'

// Categories (8 types)
type Category = 'structure' | 'naming' | 'documentation' | 
                'performance' | 'security' | 'testing' | 
                'dependency' | 'style'

// Core interfaces
interface Finding { id, severity, category, message, suggestions?, file?, line? }
interface Practice { id, title, workflow, category, severity, description, examples }
interface DetectionResult { workflow, confidence, indicators }
interface ValidationResult { workflow, findings[], duration }
interface GeneratedTemplate { workflow, files[], directories[] }
```

---

## Error Handling Strategy

**Error Types**:
1. **File System Errors** — Path not found, permission denied
2. **Validation Errors** — Invalid workflow type, malformed input
3. **Processing Errors** — Out of memory, timeout

**Error Response Format**:
```json
{
  "error": "human_readable_message",
  "code": "error_code",
  "details": "additional context"
}
```

**Handling**:
- Try/catch blocks around all async operations
- Meaningful error messages for debugging
- Graceful degradation where possible

---

## Testing Strategy

**Test Coverage**:
- ✅ Unit tests for all core components (90%+ coverage)
- ✅ Integration tests for tool chains
- ✅ Fixture-based testing with realistic projects
- ✅ Edge case testing (empty dirs, missing files, etc.)

**Test Execution**:
```bash
npm test                    # All tests
npm test -- detector.test   # Specific suite
npm run test:watch          # Watch mode
npm test -- --coverage      # With coverage report
```

---

## Future Enhancements

### Short-term (Next phases)
- [ ] Publish VS Code extension to marketplace
- [ ] Publish CLI to npm globally
- [ ] Publish RStudio addin to CRAN
- [ ] Configuration file support (.r-practices.json)
- [ ] Custom rule marketplace

### Long-term
- [ ] Web-based dashboard
- [ ] Advanced analytics and trends
- [ ] Integration with existing linters
- [ ] AI-powered suggestions
- [ ] Community rule library

---

## References

- [MCP Documentation](https://modelcontextprotocol.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [R Style Guide](https://style.tidyverse.org/)
- [Jest Documentation](https://jestjs.io/)
