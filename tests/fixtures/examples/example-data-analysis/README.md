# Example Data Analysis Project

Demonstrates data analysis best practices including:
- Standard directory structure (data/, R/, output/)
- Organized workflow
- Documentation
- Reproducibility
- Version control

## Directory Structure

```
example-data-analysis/
├── data/                    # Raw and processed data
│   ├── raw/                 # Original data files
│   └── processed/           # Cleaned/transformed data
├── R/                       # Analysis scripts
│   ├── 01_load_data.R
│   ├── 02_clean_data.R
│   └── 03_analyze.R
├── output/                  # Results, plots, tables
│   ├── figures/
│   └── tables/
├── README.md                # Project documentation
├── .gitignore              # Git configuration
└── analysis.Rmd            # Report
```

## Workflow

1. **Load Data** (`R/01_load_data.R`)
   - Import raw data from data/raw/
   - Initial exploration
   - Save to intermediate storage

2. **Clean Data** (`R/02_clean_data.R`)
   - Handle missing values
   - Standardize formats
   - Create processed dataset
   - Save to data/processed/

3. **Analyze** (`R/03_analyze.R`)
   - Statistical analysis
   - Visualization
   - Save results to output/

## Running the Analysis

```bash
# Run entire pipeline
Rscript R/01_load_data.R
Rscript R/02_clean_data.R
Rscript R/03_analyze.R

# Or source files in R
source("R/01_load_data.R")
source("R/02_clean_data.R")
source("R/03_analyze.R")
```

## Best Practices Demonstrated

✓ Clear directory structure  
✓ Numbered, descriptive script names  
✓ Separation of concerns (load → clean → analyze)  
✓ Documentation at project level  
✓ .gitignore for sensitive data  
✓ Reproducible workflow  
✓ Output organization  

## Validation with r-practices

```bash
r-practices validate .
r-practices report . --output validation-report.html
```

## Data Sources

Place raw data files in `data/raw/` with documentation of:
- Source
- Collection date
- Variables
- Units

## Output Files

Results are organized in `output/`:
- `figures/` - Generated plots (PNG, PDF)
- `tables/` - Summary tables (CSV, HTML)
- `reports/` - Analysis reports
