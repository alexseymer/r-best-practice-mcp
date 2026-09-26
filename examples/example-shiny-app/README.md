# Example Shiny Application

Demonstrates Shiny best practices including:
- Organized UI and server separation
- Reactive programming patterns
- Input validation
- Tab-based organization
- Error handling
- User feedback

## Running the App

```r
shiny::runApp()
```

## Features

- **Data Generation**: Customize sample size, mean, and standard deviation
- **Visualization**: Histogram of generated data
- **Statistics**: Summary statistics table
- **Data Display**: Full dataset with index

## Best Practices Demonstrated

✓ Clean UI/server separation  
✓ Reactive values with reactiveVal()  
✓ Event handling with observeEvent()  
✓ Input validation  
✓ Tab organization for content  
✓ Conditional rendering  
✓ Proper error messages  
✓ Helper functions for validation  

## File Structure

- `app.R` - Single-file Shiny application (UI + Server)

## Validation with r-practices

```bash
r-practices validate .
r-practices detect .
```

## Further Reading

- [Shiny Best Practices](https://shiny.rstudio.com/articles/)
- [Reactive Programming](https://shiny.rstudio.com/articles/reactive-overview.html)
- [Input Validation](https://shiny.rstudio.com/articles/validation.html)
