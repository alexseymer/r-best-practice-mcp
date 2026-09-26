# Example R Package

Demonstrates R package best practices including:
- roxygen2 documentation
- DESCRIPTION file with metadata
- NAMESPACE file with exports
- Organized R/ directory structure
- tests/ with testthat
- Proper error handling

## Installation

```r
devtools::install_local()
```

## Usage

```r
library(exampleAnalysis)

# Calculate statistics
stats <- calculate_statistics(rnorm(100))
print(stats)
```

## Best Practices Demonstrated

✓ Complete DESCRIPTION file  
✓ roxygen2 documentation (@export, @param, @examples)  
✓ Proper NAMESPACE management  
✓ Organized R/ directory  
✓ tests/ with testthat suite  
✓ Error handling with rlang  
✓ Input validation  
✓ License file  

## Validation with r-practices

```bash
r-practices validate .
r-practices validate ./R/statistics.R
r-practices report . --output report.html
```

## Quality Checks

```bash
# Run tests
devtools::test()

# Check package
devtools::check()

# Generate documentation
devtools::document()
```
