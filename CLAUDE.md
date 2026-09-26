# R Best Practices MCP Server - Architecture & Development Guide

## Project Overview

The **R Best Practices MCP Server** is a comprehensive tool for enforcing best practices across R development workflows. It integrates with Claude via the Model Context Protocol (MCP) to provide:

1. **Workflow Detection** — Identify R project types automatically
2. **Project Validation** — Check projects against 52+ best practices
3. **Template Generation** — Create scaffold projects for any workflow
4. **Knowledge Base** — Access comprehensive practice documentation

### Why This Project?

R developers often work across diverse project types (scripts, packages, Shiny apps, analyses, etc.) with different best practices for each. This MCP server provides a unified tool that Claude can use to help developers follow best practices regardless of their workflow.

## Architecture

### Core Components

```
┌─────────────────────────────────────────┐
│    MCP Server (src/server.ts)           │
│    - Exposes 6 tools via MCP            │
│    - Handles tool calls and responses   │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┬──────────┬──────────┐
        ▼             ▼          ▼          ▼
   ┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
   │Detector│  │Validator │  │Template  │  │Knowledge     │
   │        │  │          │  │Generator │  │Base          │
   └────────┘  └──────────┘  └──────────┘  └──────────────┘
        │             │          │          │
        └─────────────┴──────────┴──────────┘
                     │
        ┌────────────┴──────────────┐
        ▼                           ▼
   ┌─────────┐              ┌──────────────┐
   │FileUtils│              │Logger        │
   └─────────┘              └──────────────┘
```

### Component Responsibilities

#### 1. **WorkflowDetector** (`src/engine/detector.ts`)
- Analyzes directory structure
- Detects presence of workflow-specific files
- Scores confidence using a point system
- Returns `DetectionResult` with workflow type, confidence, and indicators

**Key Methods:**
- `detect(path)` → `DetectionResult`
- Individual checkers: `checkPackage()`, `checkShiny()`, etc.

#### 2. **Validator** (`src/engine/validator.ts`)
- Runs workflow-specific validation rules
- Validates individual files (R, Quarto, R Markdown)
- Applies filtering (severity, category, limit)
- Returns categorized `Finding[]` with severity and suggestions

**Key Methods:**
- `validateProject(path, workflow, options)` → `ValidationResult`
- `validateFile(filePath)` → `Finding[]`
- Workflow validators: `validatePackage()`, `validateShiny()`, etc.

#### 3. **TemplateGenerator** (`src/engine/template-generator.ts`)
- Generates complete project scaffolds
- Supports 9 workflow types
- Creates files with realistic content and examples
- Returns `GeneratedTemplate` with files and directories

**Key Methods:**
- `generate(workflow, options)` → `GeneratedTemplate`
- Workflow generators: `generatePackage()`, `generateShiny()`, etc.

#### 4. **KnowledgeBase** (`src/data/knowledge-base.ts`)
- Contains 52 best practices across 9 workflows
- Dual indexing: by ID and by workflow
- Supports filtering and searching
- Returns `Practice[]` with detailed information

**Key Methods:**
- `getPractice(id)` → `Practice | undefined`
- `listPractices(options)` → `PracticeQueryResult`
- `searchPractices(query)` → `PracticeQueryResult`

#### 5. **FileUtils** (`src/utils/file.ts`)
- Async file system operations
- Pattern-based file listing with recursion
- Handles edge cases (hidden files, node_modules)

**Key Methods:**
- `exists(path)`, `isDirectory(path)`, `readFile(path)`, `listFiles(dir, pattern, recursive)`

#### 6. **Logger** (`src/utils/logger.ts`)
- Simple logging with 4 levels (debug, info, warn, error)
- Timestamps all output
- Used throughout for debugging

### Type System

```typescript
// Workflows - 9 types covering all standard R development approaches
type Workflow = 'r-script' | 'quarto' | 'shiny' | 'package' | 'rmarkdown' | 'renv' | 'targets' | 'plumber' | 'analysis'

// Severity - Indicates impact of findings
type Severity = 'critical' | 'important' | 'recommended' | 'info'

// Category - Organizes findings by topic
type Category = 'structure' | 'naming' | 'documentation' | 'performance' | 'security' | 'testing' | 'dependency' | 'style'

// Finding - Individual validation result
interface Finding {
  id: string
  severity: Severity
  category: Category
  message: string
  suggestions?: string[]
  file?: string
  line?: number
}

// Practice - Best practice documentation
interface Practice {
  id: string
  title: string
  workflow: Workflow
  category: Category
  severity: Severity
  description: string
  examples: string[]
}
```

## Key Design Decisions

### 1. **Scoring-Based Detection**
Rather than binary detection, WorkflowDetector uses a confidence score (0-100%). This provides:
- Clear indication of certainty
- Ability to handle edge cases
- Better user guidance on detection accuracy

### 2. **Workflow-Specific Validators**
Instead of a single generic validator, each workflow has specialized validators:
- **Advantage**: Can implement nuanced rules specific to each workflow
- **Disadvantage**: More code, but maintainable via patterns

### 3. **MCP Tool Abstraction**
The server layer (`src/server.ts`) translates MCP tool calls to internal methods:
- Provides clean separation between protocol and logic
- Makes it easy to add tools or change implementation
- Consistent error handling across all tools

### 4. **Knowledge Base as First-Class Data**
The knowledge base is baked into the server (52 practices):
- No external dependencies for best practices
- Practices versioned with the code
- Can be easily extended or customized

### 5. **Template Generation Over CLI Scaffolding**
Rather than shell commands, templates are generated as data structures:
- **Advantage**: Can be used programmatically by Claude
- **Advantage**: Easy to customize and extend
- **Advantage**: Can return files for writing to user's system

## Best Practices Implemented

### Code Quality
- **TypeScript with strict mode** — Catches type errors at compile time
- **Comprehensive testing** — 91 tests, 90%+ code coverage
- **Async/await** — Better error handling and readability
- **Clear naming** — Functions and variables clearly express intent

### Architecture
- **Separation of concerns** — Each module has single responsibility
- **Dependency injection** — MCP server instantiates components
- **Consistent patterns** — Validators and generators follow similar structure
- **Error handling** — Try/catch blocks, error codes, user-friendly messages

### Testing
- **Unit tests** — Each component tested independently
- **Fixtures** — Consistent test data creation
- **Coverage** — 90%+ coverage in tested components
- **Fast execution** — Tests run in ~5 seconds

## Adding New Content

### Adding a Best Practice

Edit `src/data/knowledge-base.ts`:

```typescript
{
  id: 'new-practice-id',
  title: 'Practice Title',
  workflow: 'package',
  category: 'documentation',
  severity: 'important',
  description: 'Detailed description...',
  examples: ['example code...'],
}
```

### Adding a Workflow Validator

In `src/engine/validator.ts`:

```typescript
private async validateNewWorkflow(dirPath: string): Promise<Finding[]> {
  const findings: Finding[] = []
  
  // Check for required files/structure
  const requiredFile = await FileUtils.exists(`${dirPath}/required-file`)
  if (!requiredFile) {
    findings.push({
      id: 'workflow-required-file',
      severity: 'critical',
      category: 'structure',
      message: 'Workflow requires specific file...',
    })
  }
  
  return findings
}
```

### Adding a Template

In `src/engine/template-generator.ts`:

```typescript
private generateNewWorkflow(options: TemplateGeneratorOptions) {
  return {
    files: [
      { path: 'file1.txt', content: '...' },
      { path: 'file2.txt', content: '...' },
    ],
    directories: ['dir1', 'dir2'],
  }
}
```

## Testing Strategy

### Test Structure
- **Unit tests** — Each component tested independently
- **Fixtures** — Realistic test data (empty projects, complete projects, edge cases)
- **Edge cases** — Non-existent paths, empty directories, malformed files
- **Coverage** — Target 90%+ for all components

### Running Tests

```bash
# All tests with coverage
npm test

# Specific test file
npm test -- detector.test.ts

# Watch mode
npm run test:watch

# Coverage summary
npm test -- --coverage
```

## Performance Considerations

### Current Performance
- **Detection**: ~50-100ms (iterates through directory, checks files)
- **Validation**: ~100-500ms (depends on project size and number of findings)
- **Template generation**: <10ms (pure computation, no I/O)
- **Knowledge base queries**: <5ms (in-memory lookup)

### Optimization Opportunities
1. **Caching** — Cache detection results for repeated calls
2. **Parallel validation** — Run validators in parallel for different file types
3. **Lazy loading** — Load knowledge base practices on demand
4. **Compiled regex** — Pre-compile patterns used in validation

## Deployment

### MCP Server Communication
The server uses `StdioServerTransport`:
- Reads MCP requests from stdin
- Writes responses to stdout
- Allows integration with any MCP client (Claude, etc.)

### Configuration
No configuration required — server starts with default settings. Can be extended to support:
- Custom rules files
- Severity level adjustments
- Workflow-specific settings

## Future Enhancements

### Phase 4: CLI Interface
- Local command-line tool for developers
- File watching for continuous validation
- HTML report generation

### Phase 5: IDE Integration
- VS Code extension for real-time validation
- RStudio addin for package validation
- Inline suggestions in editor

### Phase 6: Advanced Features
- Custom rule creation and configuration
- Performance profiling and optimization
- Dependency analysis and update checking
- Complexity metrics and code quality scores

## Development Workflow

1. **Make changes** to TypeScript files
2. **Run tests** — `npm test` (should pass with high coverage)
3. **Build** — `npm run build` (compiles to JavaScript)
4. **Commit** — Create clear commit message with phase and description
5. **Push** — Push to development branch for review

### Code Style Guidelines
- Use TypeScript strict mode
- Async/await over promises
- Descriptive function and variable names
- Comments only for non-obvious logic
- Keep functions focused on single responsibility

### Commit Message Format
```
Phase N: Brief description

- Detailed bullet points of changes
- List new files/components
- Mention test additions

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

## Troubleshooting

### Common Issues

**Tests failing with "Cannot find module"**
- Run `npm run build` to compile TypeScript
- Check module resolution in `jest.config.js`

**Server not responding to tool calls**
- Verify stdin/stdout transport is connected
- Check tool names match exactly in handler
- Review error logs from stderr

**Validation not detecting issues**
- Check if validator for that workflow is implemented
- Review Finding IDs in knowledge base match validator IDs
- Test with fixture projects to verify behavior

## References

- [MCP Documentation](https://modelcontextprotocol.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [R Best Practices](https://style.tidyverse.org/)
- [Shiny Best Practices](https://shiny.rstudio.com/articles/basics.html)
