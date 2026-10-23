# R Best Practices MCP Server: Specification

This is the reference for what the product does, how it is built, and what is still open. It describes
the code on `main`. Where a planned change is not merged yet, it is marked **planned**. For setup and
usage, see [README.md](README.md). For internals, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 1. Purpose and scope

R projects come in many shapes: scripts, packages, Shiny apps, Quarto and R Markdown documents,
renv and targets pipelines, plumber APIs, bookdown and blogdown sites. Each has its own good practice.
The product:

1. **Detects** which kind of project a folder is.
2. **Validates** a project or a single file against the practices for that kind.
3. **Generates** a starter project for a kind.
4. **Explains** each practice, with examples and references.

It is delivered as an MCP server for AI assistants, a REST API, a browser dashboard, a command-line
tool, and editor integrations. The core is one set of rules, so every surface gives the same answers.

**Out of scope:** running R code, fixing projects automatically, storing user projects, and accounts.

## 2. Users

| User | Needs |
| --- | --- |
| R developer using an AI assistant | Ask "is this project well set up?" and get specific, referenced advice. |
| Developer or team lead | Check a project, a repository or a template against a standard, in a browser or in CI. |
| Learner | Browse the practices with good and bad examples. |
| Contributor | Propose a new or improved practice without waiting for one maintainer. |

## 3. Surfaces

### 3.1 MCP server (`dist/index.js`)

Six tools, all exposed over the Model Context Protocol:

| Tool | Purpose |
| --- | --- |
| `detect_workflow` | Identify the project type and a confidence score, with indicators. |
| `validate_project` | Check a folder against its workflow's practices. Filters by severity, category and limit. |
| `validate_file` | Check one `.R`, `.Rmd` or `.qmd` file. |
| `list_practices` | List practices with filters (workflow, category, severity, enforcement, tags, text). |
| `get_practice` | Full detail for one practice: description, details, examples, references. |
| `generate_template` | Create the file list for a starter project of a given workflow. |

Transport: standard input and output (`StdioServerTransport`).

### 3.2 REST API (`dist/web-server-entry.js`)

Versioned routes live under `/api/v1/`. The same operations are also served under `/api/` without the
version. Both are supported indefinitely; see §9. Both are described in `/openapi.json` and the interactive docs at `/api-docs`.

| Method and path | Purpose |
| --- | --- |
| `POST /api/v1/detect-workflow` | Detect a project type (server path). |
| `POST /api/v1/validate-project` | Validate a folder (server path). |
| `POST /api/v1/validate-file` | Validate one file (server path). |
| `POST /api/v1/generate-template` | Generate a starter project. |
| `GET /api/v1/practices` | List practices (paginated, filterable). |
| `GET /api/v1/practice/{id}` | One practice. |
| `POST /api/validate-upload` | Detect or validate a project sent from the browser (see §4.4). |
| `GET /api/config` | Deployment settings the dashboard needs. |
| `GET /api/tools` | The MCP tool list. |
| `GET /health` | Status, version and build information. |
| `GET /openapi.json`, `GET /api-docs` | API description and interactive docs. |
| `GET /metrics*` | Operational metrics (protected, see §6). |

Server-path endpoints only accept paths under the configured roots (§6).

### 3.3 Dashboard (`/dashboard`)

A single-page app served by the same server. Tabs: **Validate** (folder or upload), **Detect**,
**Generate**, **Practices**, **System** (health and build information). Keyboard navigation between tabs
is supported. It works at phone width (390 px), and its accessibility is checked with axe (zero
violations on every tab, including result states). It makes no requests to other origins: fonts, icons
and CSS are served by the application (Content-Security-Policy `'self'` only).

### 3.4 Command line (`r-practices`)

Commands implemented in `src/cli/commands`: `validate`, `detect`, `template`, `report`. Exit codes and
output formats are described in [CLI_GUIDE.md](CLI_GUIDE.md).

### 3.5 Editor integrations

- **VS Code extension** (`vscode-extension/`, version 0.1.0): validation diagnostics and workflow
  detection inside the editor. Marketplace publication is not done (issue #3).
- **RStudio add-in** (`rstudio-addin/`, version 0.1.0): validation, detection, template generation
  and a report from inside RStudio. Real-environment testing is not done (issue #2).

## 4. Functional requirements

### 4.1 Workflows

Twelve workflows are supported, plus `unknown` for folders that match none:

`r-script`, `quarto`, `shiny`, `package`, `rmarkdown`, `renv`, `targets`, `plumber`, `analysis`,
`bookdown`, `blogdown`, `shinytest`.

Detection gives a workflow, a confidence from 0 to 100, and the indicators that matched. A folder with
no match is reported as `unknown`, and validation then returns a warning ("not checked") rather than a
clean result.

### 4.2 Practices

Practices are data. Each is one object in `src/data/practices/<workflow>.ts` with an id, title,
workflow, category, severity, enforcement, description, details, good and bad examples, tags and
references.

- **Enforcement:** `automated` (a rule checks it) or `guidance` (advice only). Currently 70 practices:
  59 automated, 11 guidance.
- **Severity:** `critical`, `important`, `recommended`, `info`.
- **Rules:** each automated practice has one rule with the same id, in `src/engine/rules/`. A test
  fails if a rule has no practice or an automated practice has no rule.
- **Content checks:** every enforced practice needs details, distinct good and bad examples, and
  at least one HTTPS reference (`tests/unit/practice-content.test.ts`).

### 4.3 Validation output

A validation returns findings and a summary. Each finding has an id, severity, category, message,
suggestions, and optionally a file and line. Filters narrow the list; the summary always counts all
findings. Unknown workflows add a warning. A failure inside one rule is logged and skipped, so one
broken check does not hide the others.

### 4.4 Upload validation

Visitors can send a project from their browser. Limits (`src/config/runtime.ts`):

| Limit | Value |
| --- | --- |
| Files per upload | 500 |
| Size per file | 1 MB |
| Total size | 5 MB |
| Request body (this route only) | 8 MB |
| Path length | 260 characters |
| Concurrent uploads | 2 (more get `503 BUSY`) |

Only allow-listed extensions and names are accepted (for example `.R`, `.Rmd`, `.qmd`, `.yml`,
`DESCRIPTION`, `NAMESPACE`). The uploaded files are written to a private temporary folder and deleted
after the request, whatever the outcome. Upload validation is REST only and is not an MCP tool.

**Planned (in review, PR #31 step 1):** the dashboard will validate uploads in the browser, so files
do not leave the visitor's computer. The rules already read files through an interface
(`src/engine/project-fs.ts`) that a browser implementation can satisfy. The API route stays for API and
MCP users.

### 4.5 Template generation

Each workflow has a template generator (`src/engine/template-generator.ts`) that returns the files
and folders of a starter project. Generation is pure computation: it writes nothing and reads nothing.

### 4.6 Practice contributions

Anyone can propose a practice by pull request. The rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

- A practice PR changes only `src/data/practices/*.ts`. Its files are parsed as data and never run
  (`src/utils/practice-contribution.ts`). Only plain strings and lists are accepted.
- New practices must be `guidance`. Rule code (`src/engine/rules/`) always needs a maintainer.
- The merge gate (`scripts/community-practice-gate.mjs`, `.github/workflows/community-practices.yml`)
  merges a practice PR when it is at least 7 days old, has 3 approvals from eligible reviewers, has all
  checks passing, has no changes requested and no `objection` label. An eligible reviewer has write
  access or two merged pull requests in this repository.
- The gate is **off until** the repository variable `PRACTICE_AUTOMERGE` is set to `enabled`.

## 5. Quality requirements

- **Correctness:** the same rules and fixtures on disk and in memory must give identical findings
  (`tests/unit/project-fs-parity.test.ts`).
- **Tests:** unit, integration and rule tests run in CI on Node 18 and 20 (1,298 passing, 36 skipped at
  the time of writing). Line coverage must stay at or above 80% (`.github/workflows/test.yml`).
- **Static checks:** TypeScript strict mode, ESLint (zero errors), Prettier.
- **Accessibility:** zero axe violations on each dashboard tab.
- **Performance:** measured targets and baselines are in
  [docs/PERFORMANCE_BASELINE.md](docs/PERFORMANCE_BASELINE.md). Template generation does no file I/O.

## 6. Security and operations

**Requirements**

- Server-path requests are confined to the configured roots. In production the default root is
  `/projects`. A rejected path returns the same `PATH_NOT_ALLOWED` error whether the path exists or not,
  so the response does not reveal the file system.
- Rate limit: 100 requests per minute per client IP. Every response carries the limit headers. Front-end
  files are exempt. Client identity uses `req.ip`, which is correct behind a proxy only with `TRUST_PROXY`.
- Request bodies are limited to 1 MB globally; the upload route gets 8 MB.
- Responses carry security headers and a strict Content-Security-Policy (`'self'`). Gzip is enabled.
- Metrics (`/metrics*`) return 404 in production unless `METRICS_TOKEN` is set, or `METRICS_PUBLIC` is
  set deliberately.
- Errors never include server paths or stack traces. Invalid JSON returns `INVALID_JSON`.
- The Docker image runs with `NODE_ENV=production` and reports its commit and build time when those
  build arguments are set.

**Configuration** (environment variables)

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | 3000 | Listening port. |
| `NODE_ENV` | — | `production` enables the production defaults above. |
| `ALLOWED_PROJECT_ROOTS` | `/projects` in production | Comma-separated roots for server paths. |
| `ALLOW_ANY_PATH` | off | Removes the root confinement. For local use only. |
| `TRUST_PROXY` | off | Set to `1` behind a reverse proxy, so clients are identified correctly. |
| `MAX_BODY_BYTES` | 1 MB | Global request body limit. |
| `UPLOAD_TMP_DIR` | system temp | Where uploaded projects are written briefly. |
| `METRICS_TOKEN` | — | Bearer token for `/metrics*`. |
| `METRICS_PUBLIC` | off | Serve `/metrics*` without credentials. |
| `GIT_SHA`, `BUILD_TIME` | — | Build identification, shown on `/health` and in the System panel. |

**Deployment**

- Docker image (`Dockerfile`, `docker-compose.yml`). The build compiles TypeScript and the dashboard CSS.
- Publishing on version tags (`v*.*.*`): npm, Docker Hub and GHCR (`.github/workflows/publish.yml`).
  Publishing is irreversible and is only done by a maintainer.
- Continuous checks: lint, build, test on Node 18 and 20, Docker build, Docker Compose test, Trivy scan.

## 7. Non-goals

- Running or executing R code, or installing packages.
- Automatic fixes to user projects.
- Storing user projects, uploads or results.
- Replacing `lintr`, `styler` or other tools; this product checks structure and practice, not syntax.

## 8. Known limits

- The analysis rule looks for `.git` in parent folders. The server can see them; a browser upload cannot.
- Folder drag-and-drop has been tested in Chromium only, not in Safari or Firefox.
- The gate that merges practice PRs has been reviewed but not yet run against live GitHub.
- Rule code is not contributed by the community; it is maintainer-only.
- Documentation drift: README links and some reports still describe earlier states. This spec and the
  code are the reference.

## 9. Open decisions

1. **Deprecation policy (decided):** the unversioned `/api/*` routes are kept indefinitely, alongside `/api/v1/*`. Both are supported and neither is planned for removal.
2. **Upload route (decided):** `POST /api/validate-upload` is kept once the dashboard validates in the browser. The dashboard stops using it for its default upload; API and MCP clients keep it.
3. **Rule code (decided):** contributors propose guidance practices only. Any new automated check (rule code) is written and merged by a maintainer. A sandboxed declarative rule format is not planned.
4. **Publication (decided):** the VS Code extension (issue #3), the npm package (issue #4) and the tutorials (issue #5) are published after the browser-validation and spec work is merged and the live site has been re-tested.
5. **Public metrics:** whether `METRICS_PUBLIC` should be documented as a production option at all.

## 10. Glossary

- **Workflow:** a kind of R project, with its own detection, rules and template.
- **Practice:** one piece of advice, with a rationale, examples and references.
- **Rule:** the code that checks one automated practice.
- **Finding:** one result from a rule, with severity and suggestions.
- **Enforcement:** whether a practice is `automated` or `guidance`.
