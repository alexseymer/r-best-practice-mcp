# Hosting the MCP server

The same image that runs locally over stdio can run as a hosted server over HTTP. It then serves:

| URL | What |
| --- | --- |
| `/` | An information page: Practices, System status, and Setup for Claude Code, Claude Desktop, Cursor and VS Code. |
| `/mcp` | The MCP endpoint (Streamable HTTP, `POST` only). Clients connect to this URL. |
| `/health` | A health check: status, version, build and uptime. |

The hosted server has `check_files` (files sent as text) in place of `check_project`. It never reads its own disk for a
client, keeps no data, and does not log request bodies. See [SPEC.md](SPEC.md#34-hosted-http-server) for the guards.

## Run it

```bash
git clone https://github.com/alexseymer/r-best-practice-mcp.git
cd r-best-practice-mcp
GIT_SHA=$(git rev-parse HEAD) BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) docker compose up -d --build --remove-orphans
```

`--remove-orphans` removes containers of this project that the compose file no longer defines. It does nothing on a fresh
server, and it is what makes an upgrade from the old dashboard version work (see below).

`GIT_SHA` and `BUILD_TIME` are optional. They show up on `/health` and on the System tab, so you can tell which version
is running. Without them the page says "not recorded".

The container listens on `127.0.0.1:3000` of the host only. Put a reverse proxy with TLS in front of it. MCP clients
and Claude Desktop connectors need an HTTPS URL.

The compose file runs the container as a non-root user with a read-only file system, no Linux capabilities,
`no-new-privileges`, a memory limit of 256 MB and rotated logs.

## Settings

Set them in the shell or in a `.env` file next to `compose.yaml`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Host port on `127.0.0.1`. |
| `RATE_LIMIT_PER_MINUTE` | `60` | Requests per minute and client on `/mcp`. `0` turns the limit off. |
| `TRUST_PROXY` | `1` | Number of reverse proxies in front that set `X-Forwarded-For` themselves. Use `0` if clients reach the container directly. |
| `ALLOWED_ORIGINS` | empty | Extra browser origins allowed to call `/mcp`, comma separated. The server's own origin is always allowed. |
| `LOCAL_PACKAGE` | `github:alexseymer/r-best-practice-mcp` | The install spec the Setup tab shows for running the server on your own computer. Change it when you publish to npm. |

## Reverse proxy with TLS

Example for nginx (checked with `nginx -t`). Use your own domain and certificate paths:

```nginx
server {
    listen 443 ssl;
    server_name mcp.example.org;

    ssl_certificate     /etc/letsencrypt/live/mcp.example.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.example.org/privkey.pem;

    # The server accepts bodies up to 2 MB
    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        # Overwrite, do not append: a client must not be able to choose the address the rate limit counts.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Two details matter:

- **`X-Forwarded-For` is overwritten with `$remote_addr`.** With `TRUST_PROXY=1` the server counts the address the proxy
  wrote. If the proxy appended to a header the client sent, a client could pick its own address and dodge the rate limit.
- **`Host` is passed on.** The server compares the `Origin` header of browser requests with it.

Any proxy that terminates TLS and sets `X-Forwarded-For` itself works. If it does not set the header, run with
`TRUST_PROXY=0`; every client then shares the proxy's address in the rate limit.

## Check that it works

```bash
curl -s https://mcp.example.org/health
curl -s -X POST https://mcp.example.org/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The second call lists `check_files`, `get_practice` and `create_project`. `check_project` must not be there. Then open
`https://mcp.example.org/` and look at the System tab.

## Which compose file is used

The file in the repository is `compose.yaml`. When a folder holds several compose files, Docker Compose silently uses the
first one in this order: `compose.yaml`, `compose.yml`, `docker-compose.yml`, `docker-compose.yaml`. A leftover file with
an earlier name would hide the repository's file. Check which services Compose sees:

```bash
ls -1 compose.y*ml docker-compose.y*ml 2>/dev/null
docker compose config --services      # must print: mcp
```

If it prints something else, remove the stray file or name the right one: `docker compose -f compose.yaml up -d --build
--remove-orphans`.

## Update

```bash
git pull
GIT_SHA=$(git rev-parse HEAD) BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) docker compose up -d --build --remove-orphans
```

The System tab shows the commit that is running.

## Upgrading from the old dashboard version

Versions before 0.9.0 ran a REST API and a dashboard in a service called `api` (container `r-practices-api`, and
optionally `r-practices-nginx`). The current compose file does not define them. If you only run `git pull` and
`docker compose down`, **the old container keeps running**: `down` does not know it any more. It still holds
`127.0.0.1:3000`, so the new container cannot start (`port is already allocated`), and port 3000 keeps answering with the
old dashboard. It looks as if nothing changed.

Remove the old containers once, then start the new stack:

```bash
docker compose up -d --build --remove-orphans
```

If the old stack was started from a folder with a different name, Compose does not see it as part of this project. Remove
it by name:

```bash
docker rm -f r-practices-api r-practices-nginx
docker compose up -d --build
```

If your reverse proxy pointed at the Docker service name `api` (for example `proxy_pass http://api:3000`), change it to
`http://127.0.0.1:3000`. The new service is called `mcp` and is published on the loopback port only.

Check the result: `curl -s http://127.0.0.1:3000/health` must show `"version"` 0.9.0 and `"mode":"remote"`.

## What this setup does not do

- **No sign-in.** The server is meant to be free and open. The rate limit, the size limits and the concurrency limit are
  the protection against misuse. Lower `RATE_LIMIT_PER_MINUTE` if it is abused.
- **No TLS and no domain.** Your reverse proxy provides them.
- **No storage.** Nothing is written to disk. Restarting loses only the in-memory rate-limit counters.
- **No metrics endpoint.** Watch `/health` and the container logs. The logs hold the method, path, status and duration of
  each request, the tool name, and the names of its arguments. They hold no file contents and no client addresses.
