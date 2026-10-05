# Changelog

## Unreleased

### Added
- Server hardening: path confinement to `ALLOWED_PROJECT_ROOTS` (default `/projects` in production), security headers and
  CSP (`src/middleware/security-headers.ts`), gzip compression, 1 MB body limit (`MAX_BODY_BYTES`), `/metrics*` protected by
  `METRICS_TOKEN` (404 when neither a token nor `METRICS_PUBLIC=true` is set in production), `TRUST_PROXY`.
- `/health` and `/openapi.json` report the package version; `/health` also returns `build: {commit, builtAt}` (Docker build args
  `GIT_SHA`, `BUILD_TIME`). Dashboard System panel shows build info and hides metrics links when metrics are not public.
- OpenAPI structural test (`tests/unit/openapi-spec.test.ts`).
- `POST /api/validate-upload` (REST only): validate or detect a project posted as `{ files: [{ path, content }] }` from the browser, with
  strict path/size validation, a temp directory that is always deleted, at most 2 concurrent uploads (`503 BUSY`) and the limits
  from `GET /api/config`. Dashboard: "Upload a project" in the Validate and Detect tabs (folder picker, drag and drop).
- 4 practices (`pkg-structure`, `shiny-structure`, `shinytest-app`, `shinytest-setup`): 70 practices in total.
- `Practice.enforcement` (`automated` | `guidance`): 59 practices are checked by a validator rule, 11 are advice only.
- 32 new validator rules (rule registry in `src/engine/rules/`), one per automated practice that previously had none.
- Every practice now has `details`, `badExample`, `goodExample` and verified `references`.
- `minSeverity`, `categories`, `maxFindings` for `validate_project` and `validate_file` (MCP and REST), plus a pre-filter `summary`.
- `minSeverity`, `tags`, `enforcement`, `query`/`q` and `limit` for `list_practices` and `GET /api/practices` (v0 and v1).
- Dashboard: server-side filters, "X of Y" counts, automated/guidance badges, JSON/Markdown export, ZIP download of templates, System tab.
- `tests/unit/rule-consistency.test.ts`, `tests/unit/practice-content.test.ts`, `tests/e2e/dashboard.playwright.cjs`.
- `ValidationResult.warnings` (`validate_project` over MCP, REST v0/v1, CLI): an unrecognised project type now returns a warning that no checks ran
  instead of an empty "clean" result. The dashboard shows an amber card with a "Choose a workflow" button, "Not checked" in LAST AUDIT, and exports `warnings`.
- Dashboard: favicon (`/favicon.svg`, `/favicon.ico` redirects to it), `theme-color`, Open Graph and Twitter card tags.
- E2E: axe-core accessibility check on all five tabs (skipped when it cannot be loaded) and mobile tab-bar checks at 320, 360 and 390 px.
- Dashboard and `/api-docs` are fully self-hosted (#19): Tailwind is precompiled (`npm run build:css`, wired into `npm run build` and the
  Dockerfile; output `src/public/dashboard.css` is generated and git-ignored), Geist and JetBrains Mono ship as woff2 under
  `src/public/fonts/` (OFL), Material Symbols are replaced by an inline SVG sprite (`src/public/icons.svg`, `npm run build:icons`), and
  Swagger UI 5 is served from the pinned `swagger-ui-dist` package. The CSP is now `'self'` only (no `'unsafe-inline'`, no CDN origins).
  Playwright asserts no request leaves the origin and 0 CSP violations. Front-end files are exempt from the API rate limit.

### Changed
- Rate limiting identifies clients by `req.ip`; `X-Forwarded-For`/`X-Real-IP` are only honoured when `TRUST_PROXY` is set.
  `/health` is exempt, the cleanup timer is unref'd and stoppable, `/metrics/rate-limit` shows salted hashes instead of addresses.
- Default request body limit lowered from 50 MB to 1 MB.
- Finding ids `blogdown-content` and `blogdown-themes` are now `blogdown-content-structure` and `blogdown-theme` (they match their practices).
- `PracticeListOptions.severity` is now `minSeverity` (still "at least this severe").
- `bookdown-config` severity is `important` (a book builds without `_bookdown.yml`).
- Tool parameters are defined once in `src/tools/schemas.ts` and shared by the MCP server, `/api/tools` and OpenAPI.
- Logs go to stderr so stdout stays clean for the MCP stdio protocol and CLI output.

### Fixed
- Anonymous visitors could probe the server filesystem through `validate-project`/`validate-file` (200 vs 404 for any path).
- Malformed JSON bodies returned 500; they now return 400 `INVALID_JSON` (oversized bodies 413 `PAYLOAD_TOO_LARGE`).
- `X-RateLimit-*` headers were missing on the first request of a window, the request that reset it and on 429; `Retry-After` was missing.
- `/health` reported a hard-coded version `1.0.0`, OpenAPI `0.2.0`; OpenAPI contact pointed at the old repository.
- Dashboard: at 480 px and below the tab bar is icon-only (names kept as `title` and visually hidden text), so Practices and System were
  no longer pushed off-screen; the hero is a labelled landmark (axe `region` violation on every tab).
- CLI `validate` crashed when printing the summary (`result.data.duration` on an unwrapped result).
- `quarto-labels` flagged correctly labelled chunks (`#| label:`); `pkg-description` required the legacy `Author:`/`Maintainer:` fields;
  `pkg-license` required a `LICENSE` file for every license; shinytest checks only accepted the legacy `shinytest` layout;
  `analysis-readme` was reported by the Quarto validator instead of the analysis one; `rscript-globals`, `plumber-validation`
  and `plumber-error` produced noisy or comment-matched results; `blogdown-config` rejected Hugo's `hugo.toml` and `config/_default/`.
- `validate_file` returned Node's `path` module instead of the file path.
- The MCP server declared no `tools` capability and failed on construction.
- CLI: relative ESM imports lacked `.js` extensions, so `dist/bin/cli.js` could not start.
- Docker image: wrong `dumb-init` path, missing dashboard assets.
- Tests: shared timestamp temp directories caused random failures.
- Rules: two quadratic-time regexes (up to ~24 s on adversarial input), multi-line `tar_target(` calls and `#'` plumber annotations were missed.
