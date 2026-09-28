# Phase 6: Advanced Features Guide

## Overview

Phase 6 introduces enterprise-grade advanced analysis capabilities to the R Best Practices platform, enabling developers to analyze code complexity, manage dependencies, optimize performance, and apply custom validation rules.

---

## Features

### 1. Complexity Analysis

Analyze code quality metrics including cyclomatic complexity, nesting depth, and lines of code.

#### What It Measures

- **Cyclomatic Complexity**: Counts decision points (if, while, for, etc.)
  - Low (≤5): Simple, maintainable code
  - Medium (6-10): Moderate complexity
  - High (11-15): Complex, needs review
  - Critical (>15): Refactoring required

- **Nesting Depth**: Maximum level of nested code blocks
  - Tracks indentation and logical flow
  - Identifies deeply nested conditions/loops

- **Lines of Code (LOC)**: Total non-empty lines per file
  - Helps identify large files needing splitting

- **Comment Percentage**: Documentation coverage
  - Low coverage in large files triggers warnings

- **Function Count**: Number of functions per file
  - Helps understand code organization

#### Scoring

Complexity Score (0-100):
- 0-25: Excellent (low complexity)
- 26-50: Good (moderate complexity)
- 51-75: Fair (complex, review recommended)
- 76-100: Poor (critical refactoring needed)

#### Example Usage

```json
{
  "tool": "analyze_complexity",
  "arguments": {
    "path": "/path/to/project"
  }
}
```

#### Response

```json
{
  "error": false,
  "data": {
    "totalFiles": 12,
    "averageComplexity": 45.3,
    "maxComplexity": 78.5,
    "highComplexityFiles": ["R/complex_function.R"],
    "totalLinesOfCode": 5420,
    "commentPercentage": 0.12,
    "findings": [
      {
        "file": "R/complex_function.R",
        "message": "Critical complexity score: 78.5",
        "severity": "error",
        "suggestion": "Refactor into smaller functions"
      }
    ]
  }
}
```

### 2. Dependency Analysis

Analyze package dependencies and identify optimization opportunities.

#### What It Detects

- **Unused Dependencies**: Declared but never used
- **Missing Dependencies**: Used but not declared
- **Orphaned Packages**: No longer needed
- **Security Issues**: Outdated or vulnerable packages
- **Version Conflicts**: Incompatible versions

#### How It Works

1. Parses DESCRIPTION file for declared dependencies
2. Scans R files for `library()`, `require()`, and `::`
3. Compares declared vs. actual usage
4. Suggests removals and additions

#### Example Usage

```json
{
  "tool": "analyze_dependencies",
  "arguments": {
    "path": "/path/to/package"
  }
}
```

#### Response

```json
{
  "error": false,
  "data": {
    "totalDependencies": 8,
    "usedDependencies": 6,
    "unusedDependencies": ["ggplot2"],
    "missingDependencies": ["dplyr"],
    "issues": [
      {
        "package": "ggplot2",
        "issue": "unused",
        "severity": "warning",
        "message": "Package 'ggplot2' is declared but not used",
        "suggestion": "Remove from DESCRIPTION or add usage"
      },
      {
        "package": "dplyr",
        "issue": "missing",
        "severity": "error",
        "message": "Package 'dplyr' is used but not declared",
        "suggestion": "Add to Imports in DESCRIPTION"
      }
    ]
  }
}
```

### 3. Performance Analysis

Identify performance bottlenecks and optimization opportunities.

#### What It Detects

- **Vectorization Issues**: Loops that could use vector operations
- **Memory Problems**: Pre-allocation needed in loops
- **Inefficient Operations**: rbind/cbind in loops
- **String Operations**: Expensive operations in loops
- **Apply Inefficiency**: Misuse of lapply, sapply, mapply
- **Deep Nesting**: Nested loops needing refactoring

#### Performance Anti-Patterns

```r
# ❌ Bad: Loop with rbind (slow)
for (i in 1:1000) {
  df <- rbind(df, new_row)
}

# ✅ Good: Collect and combine once
rows <- lapply(1:1000, create_row)
df <- do.call(rbind, rows)
```

```r
# ❌ Bad: Vector recycling in loop
for (i in 1:n) {
  result[i] <- x[i] + y[i]
}

# ✅ Good: Direct vectorization
result <- x + y
```

#### Example Usage

```json
{
  "tool": "analyze_performance",
  "arguments": {
    "path": "/path/to/project"
  }
}
```

#### Response

```json
{
  "error": false,
  "data": {
    "totalIssues": 5,
    "criticalIssues": 2,
    "warningIssues": 3,
    "summary": "Found 5 performance issues: 2 critical, 3 warnings",
    "issues": [
      {
        "file": "R/analysis.R",
        "line": 42,
        "pattern": "rbind in loop",
        "issue": "Using rbind/cbind inside loop is inefficient",
        "severity": "error",
        "suggestion": "Collect results in list, combine after loop",
        "example": "Bad: for(i in 1:n) { df <- rbind(df, row) }\nGood: rows <- lapply(...); do.call(rbind, rows)"
      }
    ]
  }
}
```

### 4. Custom Rules

Define and apply organization-specific validation rules.

#### Built-in Rules

| Rule ID | Name | Type | Severity | Description |
|---------|------|------|----------|-------------|
| `naming-snake_case` | Snake Case Functions | naming | recommended | Function names should use snake_case |
| `function-length` | Function Length | function | important | Functions should not exceed 50 lines |
| `doc-roxygen` | Roxygen Documentation | documentation | important | Packages should use roxygen2 docs |
| `style-spaces` | Spacing Around Operators | regex | recommended | Operators should be surrounded by spaces |
| `security-eval` | Avoid eval() | regex | critical | eval() is not recommended |
| `security-system` | Avoid system() | regex | important | system() may be security risk |
| `practice-attach` | Avoid attach() | regex | important | attach() is discouraged |
| `practice-rm-all` | Avoid rm(list=ls()) | regex | recommended | Clearing environment causes issues |
| `testing-presence` | Package Testing | structure | important | Packages should have tests |

#### Creating Custom Rules

Save in `.r-best-practices-rules.json`:

```json
[
  {
    "id": "custom-naming",
    "name": "Custom Naming Rule",
    "description": "My organization's naming convention",
    "type": "regex",
    "pattern": "^[a-z_]+$",
    "severity": "important",
    "message": "Variable names must be lowercase with underscores",
    "suggestion": "Use snake_case_naming for all variables",
    "enabled": true,
    "tags": ["naming", "custom"]
  }
]
```

#### Example Usage

```json
{
  "tool": "apply_custom_rules",
  "arguments": {
    "path": "/path/to/project",
    "workflow": "package"
  }
}
```

#### Response

```json
{
  "error": false,
  "data": {
    "totalViolations": 3,
    "violations": [
      {
        "ruleId": "naming-snake_case",
        "file": "R/utils.R",
        "line": 15,
        "message": "Function names should use snake_case",
        "suggestion": "Use snake_case for function names",
        "severity": "recommended"
      }
    ],
    "rules": [
      {
        "id": "naming-snake_case",
        "name": "Snake Case Functions",
        "enabled": true
      }
    ]
  }
}
```

### 5. Automated Fixes

Generate and apply code fixes automatically.

#### Supported Fixes

- **Operator Spacing**: `x+y` → `x + y`
- **Function Naming**: `myFunc()` → `my_func()`
- **attach() Replacement**: `attach(df)` → `with(df, {...})`
- **Documentation**: Auto-generate roxygen2 skeletons
- **Code Style**: Apply formatting conventions

#### Confidence Scoring

- **High (0.85+)**: Can be applied automatically
- **Medium (0.6-0.85)**: Review recommended
- **Low (<0.6)**: Manual intervention needed

#### Example Usage

```json
{
  "tool": "get_fix_suggestion",
  "arguments": {
    "findingId": "style-spaces",
    "filePath": "/path/to/file.R",
    "lineNumber": 15
  }
}
```

#### Response

```json
{
  "error": false,
  "data": {
    "findingId": "style-spaces",
    "fix": {
      "finding": {...},
      "originalCode": "x+y",
      "fixedCode": "x + y",
      "confidence": 0.95,
      "automatic": true
    },
    "suggestion": "Add spaces around operators for better readability"
  }
}
```

---

## Integration Examples

### CLI Usage

```bash
# Analyze complexity
r-best-practices analyze-complexity /path/to/project

# Check dependencies
r-best-practices analyze-dependencies /path/to/package

# Performance review
r-best-practices analyze-performance /path/to/project

# Apply custom rules
r-best-practices validate . --custom-rules
```

### VS Code Extension

Phase 6 features available through:
- Diagnostic indicators for complex code
- Dependency warnings in DESCRIPTION
- Performance suggestions in inline diagnostics
- Custom rule violations with quick fixes

### CI/CD Integration

```yaml
# GitHub Actions
- name: Analyze Code Quality
  run: |
    r-best-practices analyze-complexity . --format json > complexity.json
    r-best-practices analyze-performance . --format json > performance.json
    r-best-practices apply-custom-rules . --format json > rules.json
```

---

## Performance Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Complexity Analysis | 50-100ms | Per project analysis |
| Dependency Analysis | 100-200ms | DESCRIPTION parsing + file scan |
| Performance Analysis | 200-400ms | Detailed pattern matching |
| Custom Rules | 50-100ms per rule | Fast regex matching |
| Fix Generation | 10-20ms | Template-based generation |

---

## Configuration

### Environment Variables

```bash
# Enable debug output
DEBUG=r-best-practices:* npm start

# Set performance threshold
COMPLEXITY_THRESHOLD=50

# Custom rules path
CUSTOM_RULES_PATH=/path/to/.r-best-practices-rules.json
```

### Settings

Configure in project `.r-best-practicesrc.json`:

```json
{
  "complexity": {
    "cyclomatic_threshold": 10,
    "nesting_depth_threshold": 4,
    "loc_warning_threshold": 500
  },
  "dependencies": {
    "check_unused": true,
    "check_missing": true,
    "suggest_updates": false
  },
  "performance": {
    "warn_on_loops": true,
    "warn_on_rbind": true,
    "suggest_vectorization": true
  },
  "rules": {
    "enabled": true,
    "custom_rules_file": ".r-best-practices-rules.json"
  }
}
```

---

## Best Practices

### Complexity Management

1. Keep cyclomatic complexity ≤ 10
2. Limit nesting depth to ≤ 3
3. Keep functions under 50 lines
4. Document complex logic with comments
5. Test thoroughly before refactoring

### Dependency Hygiene

1. Regular dependency audits
2. Remove unused packages
3. Keep packages updated
4. Document all imports
5. Use renv for reproducibility

### Performance Optimization

1. Profile before optimizing
2. Vectorize loops
3. Pre-allocate memory
4. Avoid string ops in loops
5. Use appropriate data structures

### Custom Rules

1. Define organization standards
2. Document all rules
3. Review rules quarterly
4. Keep rules focused
5. Test with real projects

---

## Troubleshooting

### High Complexity Score

**Problem**: File has complexity score > 75

**Solution**:
1. Break into smaller functions
2. Reduce nesting depth
3. Extract conditionals to variables
4. Use helper functions
5. Simplify logic flow

### Missing Dependencies

**Problem**: Warning about missing packages

**Solution**:
1. Add to DESCRIPTION (Imports or Suggests)
2. Or remove unused code
3. Check for typos
4. Verify package names

### Performance Warnings

**Problem**: rbind/cbind in loops

**Solution**:
```r
# Instead of:
for (i in 1:n) df <- rbind(df, new_row)

# Use:
rows <- vector("list", n)
for (i in 1:n) rows[[i]] <- new_row
df <- do.call(rbind, rows)
```

---

## Advanced Topics

### Custom Analysis Engine

Extend with new analyzers:

```typescript
class CustomAnalyzer {
  async analyze(projectPath: string): Promise<AnalysisResult> {
    // Your analysis logic
  }
}
```

### Rule Development

Create domain-specific rules:

```json
{
  "id": "org-naming-constants",
  "type": "regex",
  "pattern": "^[A-Z_]+$",
  "applies": "all",
  "severity": "recommended"
}
```

### Integration with Testing

Combine with test frameworks:

```bash
# Fail if complexity too high
npm test && r-best-practices analyze-complexity . --fail-on-critical
```

---

## See Also

- [README.md](./README.md) — Project overview
- [CLI_GUIDE.md](./CLI_GUIDE.md) — Command-line reference
- [OPERATIONS_MONITORING.md](./OPERATIONS_MONITORING.md) — Monitoring setup
- [SECURITY.md](./SECURITY.md) — Security configuration

---

**Phase 6 Status**: Complete ✅  
**Last Updated**: 2026-09-28  
**Version**: 0.3.0
