# R Best Practices MCP Server: Specification

This is the reference for what the server does and how it is built. It describes the code on `main`.
For installation and usage, see [README.md](README.md). For the development rules, see [CLAUDE.md](CLAUDE.md).

## 1. Purpose and scope

R projects come in several kinds: packages, Shiny apps, Quarto and R Markdown documents, data analyses and more.
Each kind has its own good practice. The server gives an MCP-capable assistant four abilities:

1. **Check** a project folder against the practices for its kind.
2. **Explain** a practice, with examples and references.
3. **Create** a standard project of one of the supported kinds, with the user's answers.

**Out of scope:** running R code, fixing projects automatically, storing user projects, accounts, a REST API for the
tools, and a command-line tool. Writing files is done by the client, never by the server. The hosted server has one
read-only information page (§3.4) and nothing else on the web.

## 2. Users

| User | Needs |
| --- | --- |
| R developer using Claude Code or Cursor | Ask "is this project well set up?" and get specific, referenced advice. |
| Developer starting a project | Create a standard project by answering a few questions. |
| Contributor | Propose or fix a practice with a test fixture. |

## 3. Surface

The server speaks MCP over stdio (`StdioServerTransport`). It declares the `tools`, `prompts` and `resources`
capabilities.

### 3.1 Tools

| Tool | Parameters | Result |
| --- | --- | --- |
| `check_project` | `path` (required, absolute), `workflow`, `minSeverity`, `categories`, `maxFindings` | `detection` (workflow, confidence, indicators) and the validation result: findings, summary, warnings. |
| `get_practice` | `id` (required) | The practice: title, description, details, examples, references. |
| `create_project` | `type` (required: `package`, `shiny`, `quarto`, `rmarkdown`, `analysis`), `projectName`, `authorName`, `authorEmail` | `files` and `directories` to create, plus the workflow. |

Errors are JSON objects with `error: true`, a `code` and a `message`. Codes used: `INVALID_PARAMETER`,
`PATH_NOT_FOUND`, `NOT_A_FOLDER` (a file was given), `NOT_FOUND`, `NEEDS_INPUT`, `CANCELLED`, `TOOL_ERROR`.

`check_project` requires an absolute path. The server resolves a relative path against its own working directory,
not against the project, so it refuses one instead of guessing.

### 3.2 Prompts

Four guided prompts. Each tells the assistant which questions to ask and how to call `create_project`:

| Prompt | Project type | Argument |
| --- | --- | --- |
| `neues-r-paket` | `package` | none |
| `neue-shiny-app` | `shiny` | none |
| `neues-quarto-projekt` | `quarto` (or `rmarkdown`) | `format`: `quarto` or `rmarkdown` |
| `neue-datenanalyse` | `analysis` | none |

### 3.3 Resources

| URI | Content |
| --- | --- |
| `practice://<id>` | One practice as Markdown. |
| `practices://all` | Index of all practices, grouped by project type. |

### 3.4 Hosted HTTP server

`node dist/http.js` serves the same MCP server over Streamable HTTP, for clients that take a URL instead of a command.

| Route | Purpose |
| --- | --- |
| `POST /mcp` | MCP requests. Stateless: every request gets its own short-lived server, and answers are plain JSON. `GET` and `DELETE` return 405. |
| `GET /health` | `status`, `version`, `mode`, `build` (`commit`, `builtAt`) and `uptimeSeconds`. |
| `GET /` | The information page with three sections: **Practices** (search and filter the 73 practices, open one for its details, examples and references, deep links such as `/#practices/pkg-readme`), **System** (status, version, build, uptime, counts, limits, tools, endpoints) and **Setup** (copyable configuration for Claude Code, Claude Desktop, Cursor and VS Code, for the hosted server and for a local install). `/dashboard` redirects to `/`. |
| `GET /api/practices`, `GET /api/system` | Read-only JSON for the page. `/api/system` shows no host details, paths or secrets. |
| `GET /app.css`, `/app.js`, `/favicon.svg` | The page's assets. Served with gzip and an ETag. |

The page needs no external files: scripts, styles and the icon come from the server itself, so the
Content-Security-Policy stays at `'self'`. It sets text only (never HTML from data) and has no write actions.

The hosted server is a different mode from the local one, because it must not read its own disk for a client:

- The tools are `check_files`, `get_practice` and `create_project`. `check_project` is not offered, and calling it by name
  returns `UNKNOWN_TOOL`.
- `check_files` takes `files` (`path` relative to the project, `content` as text) and the same filters as
  `check_project`. The files are checked in memory. Limits: 300 files, 200 000 bytes per file, 1 000 000 bytes in
  total, paths of at most 260 characters. A path that is absolute, has a drive letter, a backslash, a NUL byte or a `..`
  segment is refused with `INVALID_PARAMETER`.
- Elicitation is off. A missing project name returns `NEEDS_INPUT`, and the assistant asks in the chat.
- Request bodies and file contents are never logged; the log keeps the tool name and the argument names.

Protection for a free public server:

| Guard | Behaviour |
| --- | --- |
| Rate limit | 60 requests per minute and client on `/mcp` (`RATE_LIMIT_PER_MINUTE`, 0 = off). Answer `429` with `Retry-After`. `/health` is exempt. |
| Client address | The socket peer. `X-Forwarded-For` is read only when `TRUST_PROXY` names the number of trusted proxies; then the entry the nearest proxy added counts. |
| Body size | 2 MB, answer `413`. |
| Concurrency | 8 requests at the same time, then `503` with `Retry-After`. |
| Origin | A request that carries an `Origin` header must come from the server's own origin or one in `ALLOWED_ORIGINS`, otherwise `403`. |
| Timeouts | Headers 15 s, whole request 30 s. |
| Headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and a Content-Security-Policy. |

Settings come from environment variables: `PORT` (3000), `HOST` (0.0.0.0), `RATE_LIMIT_PER_MINUTE`, `TRUST_PROXY`,
`ALLOWED_ORIGINS` (comma separated), and `GIT_SHA` and `BUILD_TIME` for the build information in `/health`.

## 4. Functional requirements

### 4.1 Project types

Twelve types are known to the detector and the rules: `r-script`, `quarto`, `shiny`, `package`, `rmarkdown`, `renv`,
`targets`, `plumber`, `analysis`, `bookdown`, `blogdown`, `shinytest`. A folder that matches none is reported as
`unknown`, and validation then returns a warning ("not checked") rather than a clean result.

`create_project` supports five of them: `package`, `shiny`, `quarto`, `rmarkdown` and `analysis`.

### 4.2 Detection

Detection gives a workflow, a confidence from 0 to 100, and the indicators that matched. The `workflow` parameter of
`check_project` overrides it.

### 4.3 Practices

Practices are data. Each is one object in `src/data/practices/<workflow>.ts` with an id, title, workflow, category,
severity, enforcement, description, details, good and bad examples, tags and references.

- **Enforcement:** `automated` (a rule checks it) or `guidance` (advice only). Today: 73 practices, 62 automated and 11
  guidance.
- **Severity:** `critical`, `important`, `recommended`, `info`.
- **Rules:** each automated practice has one rule with the same id in `src/engine/rules/`. Tests fail if a rule has no
  practice or an automated practice has no rule.
- **Heuristics:** a check that looks for patterns in the text, rather than a fact about the project, is at most
  `recommended` and its message starts with "Consider". Facts such as a missing file or field can be `important` or
  `critical`.
- **Content:** every practice needs details, distinct good and bad examples and at least one HTTPS reference.

### 4.4 Validation output

A validation returns findings and a summary. Each finding has an id, severity, category, message, suggestions, and
optionally a file and line. Filters narrow the returned list; the summary always counts all findings. A failure inside
one rule is logged and skipped, so one broken check does not hide the others.

### 4.5 Project creation

`create_project` builds the file list from a template in `src/engine/templates/`. The templates use only three answers:
`projectName`, `authorName` and `authorEmail`. Other options would have no effect and are not offered.

Name rules:

- `package`: letters and digits, with dots allowed, starting with a letter and not ending with a dot.
- Other types: letters, digits, dots, dashes and underscores, starting with a letter, at most 64 characters.

When `projectName` is missing:

- If the client supports MCP elicitation, the server asks the user for the details directly. A refusal or cancellation
  returns `CANCELLED`.
- Otherwise the response is `NEEDS_INPUT` with the questions, and the assistant asks them in the chat.

The server never writes files. The client writes what the response lists. The prompts tell the assistant to ask before
it replaces an existing file.

## 5. Architecture

| Module | Responsibility |
| --- | --- |
| `src/index.ts`, `src/server.ts` | Entry point and MCP server: tools, prompts, resources, elicitation. |
| `src/tools/schemas.ts` | Names, descriptions and input schemas of the three tools. |
| `src/prompts.ts` | The four guided prompts. |
| `src/resources.ts` | Practices as Markdown resources. |
| `src/create-project.ts` | Name rules, questions and the call to the template generator. |
| `src/check-files.ts` | Limits and input checks for `check_files`. |
| `src/http.ts`, `src/http-server.ts`, `src/http-config.ts`, `src/rate-limit.ts` | The hosted HTTP server: entry point, routes and guards, settings, rate limiter. |
| `src/web/` | The information page: HTML, CSS and JavaScript as strings, and the routes that serve them. |
| `src/engine/` | Detector, validator, rule registry (`rules/`), template generator (`templates/`), file-system adapter. |
| `src/data/` | Knowledge base and the 73 practices. |
| `src/utils/`, `src/types/` | Logging, file helpers, parameter parsing, shared types. |

The file system is reached through the `ProjectFs` interface. The server uses the disk implementation.

## 6. Delivery

- **Source:** the GitHub repository. Installing from it runs the build (`prepare` script), so `npm exec` and
  `npm install` work without a published package.
- **Docker:** one image built from the repository, with two ways to run it. By default the container runs the stdio
  server and reads requests on stdin. With `node dist/http.js` it runs the hosted server on port 3000.
  `docker-compose.yml` runs the hosted server as a non-root user with a read-only file system, no capabilities, a
  memory limit, a health check and rotated logs, bound to `127.0.0.1` for a reverse proxy. `GIT_SHA` and `BUILD_TIME`
  build arguments show up on `/health`. See [HOSTING.md](HOSTING.md).
- **npm and Docker Hub:** not published yet. The publish workflow runs on version tags (`v*.*.*`) and needs the
  `NPM_TOKEN` and Docker Hub secrets. See [PUBLISH.md](PUBLISH.md).

## 7. Non-goals

- Running R or any R package.
- Changing a project on the user's behalf.
- Storing projects. The hosted server checks the files of one request in memory and keeps nothing.
- Interactive prompts outside MCP elicitation; anything else is reachable through tool arguments.

## 8. Open questions

1. Which of the twelve project types should `create_project` add next?
2. Should the practice list be filterable by severity or category as a tool, or is the resource index enough?
3. How should the version be set for the first public release (0.9.0 is proposed, because the tool surface changed)?
