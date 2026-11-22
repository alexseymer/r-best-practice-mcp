# Security Policy

## Supported versions

Only the latest release and the `main` branch receive fixes.

## How the server runs

- It is a local program started by your MCP client (Claude Code, Cursor) over stdio. It opens no network port.
- It runs with your user rights. It can read any folder you point `check_project` at, so only give it projects you
  trust the assistant to look at.
- It reads project files to check them and returns findings and suggestions. It does not send them anywhere and does
  not store them.
- `create_project` returns file contents. The server does not write files; your client does, after you agree.
- The Docker image runs as a non-root user and needs no privileges.

## Supply chain

- Installing from GitHub (`npm exec --package=github:…`) runs the build (`prepare` script) and the dependency install
  scripts of your machine. Pin a commit (`#<sha>`) when you need a fixed version.
- Dependencies are the MCP SDK and the development tools for building and testing. The runtime has no native
  dependencies.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through the Security tab of the
repository (Report a vulnerability). Include the version or commit, the steps to reproduce, and the expected and actual
behaviour.
