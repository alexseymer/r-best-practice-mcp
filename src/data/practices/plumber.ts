import { Practice } from '../../types/practice.js';

export const plumberPractices: Practice[] = [
  {
    id: 'plumber-paths',
    title: 'Use clear, RESTful paths',
    workflow: 'plumber',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Follow REST conventions (GET /api/data, POST /api/data)',
    details:
      "REST paths name resources with lowercase nouns, and the HTTP method says what to do with them. Avoid verbs and mixed case in paths, and use <id> for dynamic segments. The automated check is a heuristic on @get/@post/@put/@delete/@patch/@head/@options annotations written as either #* or #' in .R files anywhere in the project (hidden folders and folders such as renv, docs and public are skipped). After removing <dynamic> and {placeholder} segments it flags a path that contains an uppercase letter or an underscore, or whose first segment starts with get, create, delete, update, set, add or remove followed by an underscore, hyphen or capital letter (get_users, createUser, delete-item). It does not judge nouns or plural forms.",
    badExample: `#* @get /getUsers
function() list_users()

#* @post /Create_User
function(name) create_user(name)

#* @post /delete_user
function(id) delete_user(id)`,
    goodExample: `#* List users
#* @get /users
function() list_users()

#* Create a user
#* @post /users
function(name) create_user(name)

#* Delete a user
#* @delete /users/<id>
function(id) delete_user(id)`,
    tags: ['plumber', 'rest'],
    references: [
      'https://www.rplumber.io/articles/routing-and-input.html',
      'https://www.rplumber.io/articles/annotations.html',
    ],
  },
  {
    id: 'plumber-validation',
    title: 'Validate and sanitize all inputs',
    workflow: 'plumber',
    category: 'security',
    severity: 'critical',
    enforcement: 'automated',
    description: 'Never trust user input; validate all parameters',
    details:
      "Query and body parameters arrive as untrusted strings and must be checked for type, range and length before use. Reject bad input with a 400 response instead of passing it to code that touches files, databases or system calls. The automated check is a coarse keyword heuristic. It only looks at .R files directly in the project root that contain a plumber endpoint annotation (#* or #' followed by @get, @post, ...), ignores lines that are entirely a comment, and reports a file in which none of the text validate, check or if ( (with optional spaces before the parenthesis) appears; any substring match counts, for example in a variable name. It cannot tell whether the validation covers every parameter.",
    badExample: `#* @get /square
function(n) {
  as.numeric(n)^2
}`,
    goodExample: `#* @get /square
function(n, res) {
  value <- suppressWarnings(as.numeric(n))
  if (length(value) != 1 || is.na(value) || abs(value) > 1e6) {
    res$status <- 400
    return(list(error = "n must be a single number between -1e6 and 1e6"))
  }
  list(result = value^2)
}`,
    tags: ['plumber', 'security'],
    references: [
      'https://www.rplumber.io/articles/routing-and-input.html',
      'https://www.rplumber.io/articles/security.html',
    ],
  },
  {
    id: 'plumber-response',
    title: 'Return consistent JSON responses',
    workflow: 'plumber',
    category: 'structure',
    severity: 'recommended',
    enforcement: 'guidance',
    description: 'Use consistent structure: {status, data, error}',
    details:
      'Clients are simpler and more robust when every endpoint returns the same envelope for success and failure. Pick one shape, for example status, data and error fields, and build it with a small helper. Plumber serializes lists to JSON by default. This is guidance only and is not checked automatically.',
    badExample: `#* @get /mean
function(x) {
  # sometimes a bare number, sometimes a string, sometimes a list
  if (missing(x)) return("x is required")
  mean(as.numeric(strsplit(x, ",")[[1]]))
}`,
    goodExample: `ok <- function(data) list(status = "ok", data = data)
fail <- function(msg) list(status = "error", error = msg)

#* @get /mean
function(x, res) {
  if (missing(x)) {
    res$status <- 400
    return(fail("x is required"))
  }
  ok(mean(as.numeric(strsplit(x, ",")[[1]])))
}`,
    tags: ['plumber', 'api'],
    references: ['https://www.rplumber.io/articles/rendering-output.html'],
  },
  {
    id: 'plumber-status',
    title: 'Use appropriate HTTP status codes',
    workflow: 'plumber',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Return 200 OK, 400 Bad Request, 500 Internal Error, etc.',
    details:
      'Status codes let clients and monitoring tell success from failure without parsing the body. Add res to the endpoint arguments and set res$status to 400 for bad input, 404 for a missing resource and 500 for server errors. The automated check is a keyword heuristic over all .R files in the project (hidden folders and folders such as renv, docs and public are skipped; comments are ignored): when the project defines at least one endpoint annotation (#* or #\' with @get, @post, ...), it flags the project unless some file contains res$status or res[["status"]]. It does not check that the codes are correct or set on every error path.',
    badExample: `#* @get /user/<id>
function(id) {
  user <- find_user(id)
  if (is.null(user)) {
    return(list(error = "not found"))  # still HTTP 200
  }
  user
}`,
    goodExample: `#* @get /user/<id>
function(id, res) {
  user <- find_user(id)
  if (is.null(user)) {
    res$status <- 404
    return(list(error = "user not found"))
  }
  user
}`,
    tags: ['plumber', 'http'],
    references: [
      'https://www.rplumber.io/articles/rendering-output.html',
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status',
    ],
  },
  {
    id: 'plumber-error',
    title: 'Include meaningful error messages',
    workflow: 'plumber',
    category: 'structure',
    severity: 'important',
    enforcement: 'automated',
    description: 'Provide clear error descriptions for debugging',
    details:
      "Clear error messages tell API users what went wrong without exposing internals such as stack traces or file paths. Wrap risky work in tryCatch(), return a short message with a suitable status, and log details on the server. The automated check is a coarse keyword heuristic. It only looks at .R files directly in the project root that contain a plumber endpoint annotation (#* or #' followed by @get, @post, ...), ignores lines that are entirely a comment, and reports a file that has no actual call to tryCatch(, stop( or warning( anywhere in it (not necessarily inside an endpoint). It cannot tell whether errors are handled well.",
    badExample: `#* @get /report
function(id) {
  read.csv(paste0("data/", id, ".csv"))
}`,
    goodExample: `#* @get /report
function(id, res) {
  tryCatch(
    read.csv(file.path("data", paste0(basename(id), ".csv"))),
    error = function(e) {
      message("report failed: ", conditionMessage(e))
      res$status <- 404
      list(error = paste("No report found for id", id))
    }
  )
}`,
    tags: ['plumber', 'errors'],
    references: [
      'https://www.rplumber.io/articles/rendering-output.html',
      'https://www.rplumber.io/articles/tips-and-tricks.html',
    ],
  },
  {
    id: 'plumber-docs',
    title: 'Document API endpoints with comments',
    workflow: 'plumber',
    category: 'documentation',
    severity: 'recommended',
    enforcement: 'automated',
    description: 'Add #* @param, #* @get comments for API documentation',
    details:
      "Plumber builds the OpenAPI specification and the interactive docs page from the #* comments, so a description and @param lines become the API documentation. Put a plain description line and a @param line per argument above each endpoint. The automated check is a heuristic over .R files anywhere in the project (hidden folders and folders such as renv, docs and public are skipped). Both #* and #' annotations are recognised. It flags an endpoint annotation (@get, @post, ...) whose block of consecutive #* / #' lines has no non-empty line that does not start with @; a description separated from the annotation by a blank or code line does not count, and @param lines alone do not count. It does not check that every argument has a @param line.",
    badExample: `#* @get /sum
function(a, b) {
  as.numeric(a) + as.numeric(b)
}`,
    goodExample: `#* Add two numbers
#* @param a First number
#* @param b Second number
#* @get /sum
function(a, b) {
  as.numeric(a) + as.numeric(b)
}`,
    tags: ['plumber', 'documentation'],
    references: [
      'https://www.rplumber.io/articles/annotations.html',
      'https://www.rplumber.io/articles/quickstart.html',
    ],
  },
];
