# Dashboard User Guide

The dashboard is a standalone web UI for checking R projects without an MCP client or an AI assistant.
It talks to the same REST API as the MCP tools.

Start it with `npm run build && npm run start:web` and open `http://localhost:3000/dashboard`
(Docker: `docker compose up`). It loads Tailwind CSS and fonts from a CDN, so it needs internet access to look right;
all functions work without it.

**Paths are resolved on the machine running the server.** In Docker only mounted folders are visible
(see `docker-compose.yml`), and the browser cannot upload or browse local files.

## Tabs

| Tab | What it does | Backend |
|---|---|---|
| **Validate** | Audit a project folder, optionally forcing the workflow, or validate one file | `POST /api/validate-project`, `POST /api/validate-file` |
| **Detect** | Identify the workflow with a confidence score and the evidence; jump to validate or generate | `POST /api/detect-workflow` |
| **Generate** | Create a project template, preview each file, download one file or everything as a ZIP (built in the browser) | `POST /api/generate-template` |
| **Practices** | Browse the 70 practices; filter by workflow, category, minimum severity and check type; text search; examples and references | `GET /api/practices` |
| **System** | Server health, per-operation counts, endpoint reference, OpenAPI spec and CSV exports | `/health`, `/api/tools`, `/openapi.json`, `/metrics/*.csv` |

## Validate

- **Filters** (sent to the server): minimum severity, categories, max findings. Results show "Showing X of Y findings" (Y is counted before the filters).
- **View refinements** (in the browser): severity chips, category and text filter over the returned findings.
- **Export**: copy or download the report as JSON, or download it as Markdown (includes the filters used).
- **View practice** on a finding opens the matching practice card.
- The single-file check runs the original file-level rules only (`.R`, `.qmd`, `.Rmd`); the 32 newer rules work on whole projects.

## Upload a project

The Validate and Detect tabs have an **Upload a project** section above the server-path form, so a project that lives on your
computer can be checked on a hosted dashboard (where the server cannot see your disk).

- **Choose a project folder** (keyboard operable) opens a folder picker; you can also drag a folder onto the drop zone or pick
  individual files. Paths are sent relative to the folder you chose.
- Skipped in the browser: `node_modules`, `.git`, `renv`, `_book`, `_site`, files of unsupported types, files larger than the
  per-file limit. A summary such as "142 files, 1.2 MB (38 skipped)" is shown; if the supported files exceed the limits
  (`GET /api/config`, `upload`) the numbers are shown and nothing is sent.
- **Run project audit** uses the workflow select and the Filters block of the Validate form and renders the result like a normal
  audit (`POST /api/validate-upload`). On the Detect tab the same selection is sent with `detectOnly` and shows the detection card;
  "Validate as ..." then audits the upload.
- Your files are sent to the server for analysis and deleted immediately; nothing is stored.
- When the server restricts paths (`ALLOWED_PROJECT_ROOTS`, or `NODE_ENV=production`), the help text reads "Server paths are limited
  to: ..." and the server-path forms are collapsed under "Advanced: analyse a folder on the server"; the upload section is then the
  primary option.

## Practices

Each card shows a badge: **Automated check** (a validator rule with the same id reports violations) or
**Guidance only** (advice; never produces findings). Cards expand to show details, an "Avoid" and a "Prefer" example, tags and references.
Deep links: `#practices/<id>`, for example `#practices/pkg-roxygen`.

## Keyboard and routing

Tabs support arrow keys; the URL hash selects the tab (`#validate`, `#detect`, `#generate`, `#practices`, `#system`).
Recently used project paths are remembered in the browser (localStorage).

## Testing

`BASE_URL=http://localhost:3000 node tests/e2e/dashboard.playwright.cjs` drives every control in a real browser
(needs Playwright and Chromium; the server must be running).
