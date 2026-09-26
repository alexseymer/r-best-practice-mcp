# Automated Fixes Tutorial

Learn how to use the automated fixes engine to fix common issues automatically.

## What are Automated Fixes?

The R Best Practices tool includes 6 automated fixes that can address common coding issues without manual intervention:

1. **add-function-docs** - Generate roxygen2 documentation templates
2. **add-library** - Insert missing library() calls
3. **remove-trailing-whitespace** - Clean up formatting
4. **add-braces** - Add missing braces to if/else statements
5. **standardize-assignment** - Convert `=` to `<-` for assignments
6. **add-namespace** - Add package namespace prefixes (pkg::function)

## Using Fixes via CLI

### List Available Fixes

```bash
r-practices fixes --list
```

Shows all available fixes with descriptions.

### Apply a Single Fix

```bash
r-practices fix add-library ./R/script.R
```

Applies the fix and shows what changed.

### Apply All Applicable Fixes

```bash
r-practices fix --all ./R/
```

Runs all fixes that apply to the directory.

### Dry Run (Preview Changes)

```bash
r-practices fix --dry-run add-library ./R/script.R
```

Shows what would change without applying.

### Interactive Mode

```bash
r-practices fix --interactive ./R/
```

Prompts before applying each fix.

## Fix Details

### 1. add-function-docs

**What it does:** Generates roxygen2 documentation templates for functions.

**Before:**
```r
calculate_mean <- function(x, na.rm = TRUE) {
  mean(x, na.rm = na.rm)
}
```

**After:**
```r
#' Calculate Mean
#'
#' @param x A numeric vector
#' @param na.rm Logical; remove NA values?
#'
#' @return The mean value
#'
#' @examples
#' calculate_mean(c(1, 2, 3, 4, 5))
#'
#' @export
calculate_mean <- function(x, na.rm = TRUE) {
  mean(x, na.rm = na.rm)
}
```

**When to use:** Before publishing packages, to ensure all exported functions are documented.

### 2. add-library

**What it does:** Adds library() calls for functions that use external packages.

**Before:**
```r
data %>%
  filter(value > 100) %>%
  select(id, name)
```

**After:**
```r
library(dplyr)

data %>%
  filter(value > 100) %>%
  select(id, name)
```

**When to use:** After copying code snippets or adding new dependencies.

### 3. remove-trailing-whitespace

**What it does:** Removes unnecessary spaces at end of lines.

**Before:**
```r
x <- 5          
y <- 10         
z <- x + y      
```

**After:**
```r
x <- 5
y <- 10
z <- x + y
```

**When to use:** Code cleanup, style consistency.

### 4. add-braces

**What it does:** Adds braces to if/else statements for consistency.

**Before:**
```r
if (x > 0)
  print(\"positive\")
else
  print(\"non-positive\")
```

**After:**
```r
if (x > 0) {
  print(\"positive\")
} else {
  print(\"non-positive\")
}
```

**When to use:** Enforcing consistent style, improving readability.

### 5. standardize-assignment

**What it does:** Converts `=` to `<-` for assignments (R convention).

**Before:**
```r
x = 5
y = function(a) { a = 10; a }
```

**After:**
```r
x <- 5
y <- function(a) { a <- 10; a }
```

**When to use:** Following R style guidelines, preparing for package submission.

### 6. add-namespace

**What it does:** Adds package namespace prefixes for clarity.

**Before:**
```r
x <- tibble(a = 1, b = 2)
```

**After:**
```r
x <- tibble::tibble(a = 1, b = 2)
```

**When to use:** Avoiding namespace conflicts, improving code clarity.

## Workflows

### Workflow 1: Fix Package Before Publishing

```bash
# 1. Add documentation to functions
r-practices fix add-function-docs ./R/

# 2. Add library calls for dependencies
r-practices fix add-library ./R/

# 3. Standardize assignment operators
r-practices fix standardize-assignment ./R/

# 4. Add braces for consistency
r-practices fix add-braces ./R/

# 5. Clean up whitespace
r-practices fix remove-trailing-whitespace ./R/

# 6. Verify fixes
r-practices validate .
```

### Workflow 2: Clean Up Existing Project

```bash
# Dry run to preview changes
r-practices fix --all --dry-run ./R/

# Apply all fixes
r-practices fix --all ./R/

# Verify result
r-practices validate .
```

### Workflow 3: Interactive Fixing

For careful changes, use interactive mode:

```bash
r-practices fix --interactive add-function-docs ./R/
```

For each function, you'll be prompted:
```
Fix add-function-docs in calculate_mean?
[y]es / [n]o / [a]ll / [q]uit: 
```

## Batch Fixing Multiple Directories

```bash
# Fix all R files in project
r-practices fix --all ./

# Fix specific workflow
r-practices fix --all --workflow package .

# Fix with filtering
r-practices fix --all --category documentation ./R/
```

## Combining with Validation

Typical workflow:

```bash
# 1. Validate to see issues
r-practices validate . --limit 20

# 2. Apply automated fixes
r-practices fix --all ./R/

# 3. Validate again to see remaining issues
r-practices validate .

# 4. Manually fix remaining issues
```

## Before and After Comparison

Generate reports before and after fixes:

```bash
# Before
r-practices report . --output before.html

# Apply fixes
r-practices fix --all ./R/

# After
r-practices report . --output after.html

# Compare both reports
open before.html after.html
```

## Advanced: Custom Fix Combinations

Create a shell script for your project's specific needs:

```bash
#!/bin/bash
# fix-project.sh

echo \"Fixing R project...\"

# Step 1: Add documentation
r-practices fix add-function-docs ./R/

# Step 2: Add missing libraries
r-practices fix add-library ./R/

# Step 3: Standardize style
r-practices fix standardize-assignment ./R/
r-practices fix add-braces ./R/
r-practices fix remove-trailing-whitespace ./R/

# Step 4: Verify
r-practices validate .

echo \"Done!\"
```

Run it:
```bash
chmod +x fix-project.sh
./fix-project.sh
```

## Limitations and When to Manually Fix

### Automated Fixes Can't Handle:

- Logic errors (wrong algorithm)
- Missing error handling
- Incomplete documentation (they create templates)
- Performance issues
- Architectural problems

### Manually Fix When:

The issue involves changing logic, not just style:
```r
# Automated can't fix this logic error
if (x > 10)      # Should be x < 10
  print(\"low\")
```

### Keep Manual Fixes For:

- Complex refactoring
- Architecture changes
- Business logic improvements
- Workflow-specific patterns

## Integration with VS Code and RStudio

### VS Code

Quick fixes appear as blue lightbulbs. Click to apply individual fixes:

```r
x = 5  // Lightbulb suggests 'standardize-assignment'
```

### RStudio

Use CLI in terminal pane while editing:

```bash
# Terminal pane
r-practices fix add-library ./R/my-script.R

# Then reload in R console
source(\"./R/my-script.R\")
```

## Best Practices with Automated Fixes

### 1. Preview First
Always use `--dry-run` before applying:
```bash
r-practices fix --dry-run --all ./R/
```

### 2. Commit Before Fixing
Use version control to capture original:
```bash
git add .
git commit -m \"Before automated fixes\"
r-practices fix --all ./R/
git diff  # Review changes
```

### 3. Review Changes
Even automated changes deserve review:
```bash
git diff ./R/
```

### 4. Test After Fixing
Run tests after applying fixes:
```bash
r-practices fix --all ./R/
npm test  # or devtools::test()
```

### 5. Use in CI/CD
Automated fixing can be part of code quality pipeline:
```yaml
# .github/workflows/fix.yml
- name: Apply fixes
  run: r-practices fix --all ./R/
```

## Troubleshooting

### Fixes Not Applied

1. Check file format:
```bash
file ./R/script.R  # Should be text
```

2. Verify file is valid R:
```r
parse(\"./R/script.R\")  # Should not error
```

### Unexpected Changes

1. Use dry-run first
2. Review with git diff
3. Check fix descriptions

### Conflicts with Linters

If fixes conflict with your linter:
- Review linter configuration
- Disable conflicting rules
- Adjust fix options

## Next Steps

1. Run validation on your project
2. Use `--dry-run` to preview automated fixes
3. Apply appropriate fixes
4. Verify tests still pass
5. Review diffs carefully
6. Commit improved code

## Resources

- [Automated Fixes Reference](../automated-fixes-reference.md)
- [Best Practices Guide](./05-best-practices-deep-dive.md)
- [CLI Quick Start](./02-cli-quickstart.md)
