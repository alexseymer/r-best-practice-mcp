# R Best Practices MCP Server

An [MCP](https://modelcontextprotocol.io) server for R projects. Your AI assistant can use it to check a project against
R best practices, explain each practice, and create a standard project with you, step by step.

It works with Claude Code, Cursor and other MCP clients over stdio. It has no web interface, no REST API and no
command-line tool: the server and the assistant are the whole product.

## What it gives your assistant

| Kind | Name | What it does |
| --- | --- | --- |
| Tool | `check_project` | Detects the project type (or uses the one you give) and returns the findings, with severity and suggestions. |
| Tool | `get_practice` | Explains one practice: why it matters, what is checked, good and bad examples, references. |
| Tool | `create_project` | Returns the files of a standard project. The assistant writes them into your folder. |
| Prompt | `neues-r-paket` | Guides you through a new R package. |
| Prompt | `neue-shiny-app` | Guides you through a new Shiny app. |
| Prompt | `neues-quarto-projekt` | Guides you through a Quarto or R Markdown project (`format` argument: `quarto` or `rmarkdown`). |
| Prompt | `neue-datenanalyse` | Guides you through a data analysis project with `renv`. |
| Resource | `practice://<id>` | One practice as Markdown. |
| Resource | `practices://all` | An index of all practices, grouped by project type. |

The knowledge base holds 73 practices for 12 project types. 62 are checked automatically, 11 are guidance only.

## Install

The server is not published to npm or Docker Hub yet. Install it straight from GitHub.

### Claude Code

```bash
claude mcp add --scope user r-practices -- npm exec --yes --package=github:alexseymer/r-best-practice-mcp -- r-best-practices-mcp
```

Or add it to a project's `.mcp.json`:

```json
{
  "mcpServers": {
    "r-practices": {
      "command": "npm",
      "args": ["exec", "--yes", "--package=github:alexseymer/r-best-practice-mcp", "--", "r-best-practices-mcp"]
    }
  }
}
```

### Cursor

Add the same entry to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project).

### Docker

```bash
docker build -t r-practices https://github.com/alexseymer/r-best-practice-mcp.git
```

Then use `docker run -i --rm r-practices` as the command in your client's MCP configuration.

### Updating

`npm exec` caches the package. To get a newer version, pin a commit (`github:alexseymer/r-best-practice-mcp#<sha>`) or
clear the npm cache.

## Using it

- Ask "check this project" with the absolute path of the project folder. The assistant calls `check_project`.
- Ask "explain `pkg-readme`". The assistant calls `get_practice`, or reads `practice://pkg-readme`.
- Run a prompt, for example `/mcp__r-practices__neues-r-paket` in Claude Code. The assistant asks for the project
  name, the author and an optional e-mail address, then writes the files into the folder you name.

The server never writes files itself. `create_project` only returns the file list, and the prompts tell the assistant to ask before it replaces an existing file.

## Development

Requires Node.js 20 or newer.

```bash
npm install      # also builds the server (prepare script)
npm run build    # compile to dist/
npm test         # unit and regression tests
npm run lint
```

Start the server by hand for a quick check:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' \
  | node dist/index.js
```

The architecture, the rules for adding practices and templates, and the product specification are in
[SPEC.md](SPEC.md) and [CLAUDE.md](CLAUDE.md). Contribution rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
