# R Best Practices MCP Server: Development Guide

This file is for the people and agents who change the code. For what the product does, read [SPEC.md](SPEC.md).

## What the server is

An MCP server over stdio with three tools (`check_project`, `get_practice`, `create_project`), four guided prompts and
the practices as resources. It has no web interface, no REST API and no command-line tool. Keep it that way unless the
spec changes first.

## Principles

Small, focused, cooperating programs, and open, iterative development.

- **Do one thing well.** The engine checks the structure and practice of R projects. It does not run R, fix projects,
  or store them. A feature outside detect, check, explain and create needs a strong case in SPEC §7.
- **Text is the interface.** Tool results are JSON. Practices and rules are plain code and data in the repository.
- **Small is beautiful.** One rule is one function in `src/engine/rules/<workflow>.ts`. One practice is one data object.
- **Portable.** Node 20 or newer, no native dependencies, any operating system. Paths go through `ProjectFs`.
- **No captive interface.** Everything is reachable through tool arguments. Prompts only guide the assistant.
- **Small pull requests.** One concern each, merged when CI is green. Decisions go into SPEC.md or the issues, not into chat.

Checklist for every change:

1. Is it inside the scope in SPEC §1 and §7?
2. Is the smallest working version shipped first, with the next step left as an issue?
3. Is it covered by a test, and documented where a user will look for it?

## Architecture

| Module | Responsibility |
| --- | --- |
| `src/index.ts`, `src/server.ts` | Entry point and MCP server: tools, prompts, resources, elicitation. |
| `src/tools/schemas.ts` | The three tools: names, descriptions, input schemas. |
| `src/prompts.ts` | The four guided prompts (German). |
| `src/resources.ts` | Practices as Markdown (`practice://<id>`, `practices://all`). |
| `src/create-project.ts` | Name rules, questions, call to the template generator. |
| `src/engine/detector.ts` | Workflow detection with a confidence score. |
| `src/engine/validator.ts` | Runs the registered rules for a workflow and applies the filters. |
| `src/engine/rules/` | One rule per automated practice, plus shared helpers and file checks. |
| `src/engine/templates/` | One generator per project type. `template-generator.ts` dispatches to them. |
| `src/engine/project-fs*.ts` | File-system access behind an interface, for disk and in-memory projects. |
| `src/data/knowledge-base.ts`, `src/data/practices/` | The 73 practices. |
| `src/utils/`, `src/types/`, `src/config/` | Logging, file helpers, parameter parsing, shared types, runtime settings. |

Logs go to stderr. Stdout is reserved for the MCP protocol.

## Adding a best practice

Add the object to `src/data/practices/<workflow>.ts`. Every practice needs `details`, `badExample`, `goodExample` and at
least one verified `https` reference. `tests/unit/practice-content.test.ts` enforces this.

```typescript
{
  id: 'pkg-example',
  title: 'Practice Title',
  workflow: 'package',
  category: 'documentation',
  severity: 'important',
  enforcement: 'guidance', // 'automated' once a rule with this id exists
  description: 'Short description...',
  details: 'Why it matters and, for automated practices, exactly what the check looks at.',
  badExample: '...',
  goodExample: '...',
  references: ['https://r-pkgs.org/'],
  tags: ['example'],
}
```

## Adding a rule (automated check)

1. Add the practice with `enforcement: 'automated'`. The rule id must equal the practice id.
2. Add a `RuleDef` to `src/engine/rules/<workflow>.ts`. Helpers such as `findFiles` and `readText` are in
   `src/engine/rules/helpers.ts`, and they cap file count and size.

```typescript
{
  id: 'pkg-example',
  workflows: ['package'],
  async run({ dirPath }) {
    // return [] when satisfied, otherwise findings whose severity and category match the practice
    return [{ id: 'pkg-example', severity: 'important', category: 'documentation',
              message: '...', suggestions: ['...'] }]
  },
}
```

3. Add tests in `tests/unit/rules/<workflow>.test.ts`: a triggering fixture, a clean fixture and, for heuristics, a
   near-miss that must not trigger. Content-based rules cap severity at `recommended` and say "Consider ...".
4. `tests/unit/rule-consistency.test.ts` fails if a rule has no practice, an automated practice has no rule, or a
   guidance practice has one.

## Adding a project template

Add `src/engine/templates/<workflow>.ts` with a generator that returns `{ files, directories }`, and call it from the
switch in `src/engine/template-generator.ts`. The generator may use only `projectName`, `authorName` and `authorEmail`.
If the project type should be creatable by `create_project`, also add it to `PROJECT_TYPES` in `src/tools/schemas.ts`
and to the prompts in `src/prompts.ts`.

`tests/unit/template-consistency.test.ts` requires every template to be detected as its own workflow and to pass the
project's own rules.

## Testing

```bash
npm test                              # all tests with coverage
npm test -- mcp-surface               # one file, by name
npm run lint
npx tsc --noEmit
```

Fixtures for detection and regression tests are in `tests/fixtures/`, including example projects under
`tests/fixtures/examples/`. The tests import the TypeScript sources directly. Run `npm run build` before you start the
server by hand.

## Build, install and release

- `npm run build` compiles to `dist/`. The `prepare` script runs it on install, so installing from GitHub works.
- The Docker image is built from the repository. Its stages skip install scripts and run the build explicitly.
- A version tag (`v*.*.*`) starts `publish.yml`, which publishes to npm and Docker Hub. Do not push such a tag until the
  release is decided. See [PUBLISH.md](PUBLISH.md).

## Commit and pull request conventions

- Subject in the imperative, describing the change. Body explains the why.
- One concern per pull request. Merge when CI is green.

## References

- [MCP specification](https://modelcontextprotocol.io/)
- [R Packages (Wickham and Bryan)](https://r-pkgs.org/)
- [tidyverse style guide](https://style.tidyverse.org/)
