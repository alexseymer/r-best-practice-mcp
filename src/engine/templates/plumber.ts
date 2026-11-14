import { TemplateFile, TemplateGeneratorOptions } from '../../types/template.js';

export function generatePlumber(options: TemplateGeneratorOptions): {
  files: TemplateFile[];
  directories: string[];
} {
  const projectName = options.projectName || 'api';

  return {
    files: [
      {
        path: 'api.R',
        content: `library(plumber)

# Validate input
validate_input <- function(x) {
  if (is.na(x) || x < 0) {
    stop("Input must be a positive number")
  }
  TRUE
}

#* @apiTitle ${projectName} API
#* @apiDescription API for demonstrating Plumber functionality

#* Greet a person by name
#* @get /hello
#* @param name:string Name to greet
function(name = "World") {
  list(message = paste0("Hello, ", name, "!"))
}

#* Add two numbers
#* @post /add
#* @param a:numeric First number
#* @param b:numeric Second number
function(a, b, res) {
  tryCatch({
    validate_input(a)
    validate_input(b)
    list(result = a + b)
  }, error = function(e) {
    res$status <- 400
    list(error = TRUE, message = e$message)
  })
}

#* Report whether the API is healthy
#* @get /status
function() {
  list(
    status = "healthy",
    timestamp = Sys.time()
  )
}
`,
      },
      {
        path: 'run.R',
        content: `library(plumber)

# Load the API
pr <- plumb_file("api.R")

# Run the server
pr$run(host = "127.0.0.1", port = 8000)
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Plumber REST API.

## Running the API

\`\`\`bash
Rscript run.R
\`\`\`

The API will be available at http://localhost:8000

## Endpoints

### GET /hello
\`\`\`bash
curl "http://localhost:8000/hello?name=Alice"
\`\`\`

### POST /add
\`\`\`bash
curl -X POST "http://localhost:8000/add?a=5&b=3"
\`\`\`

### GET /status
\`\`\`bash
curl "http://localhost:8000/status"
\`\`\`

## Requirements

- R >= 4.0.0
- plumber package

## Documentation

See [Plumber documentation](https://www.rplumber.io/) for more information.
`,
      },
    ],
    directories: [],
  };
}
