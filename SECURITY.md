# Security Best Practices & Guidelines

## Overview

This document outlines security best practices for the R Best Practices MCP Server, including deployment, configuration, and operational security.

## Table of Contents

1. [Input Validation & Sanitization](#input-validation--sanitization)
2. [Path Traversal Protection](#path-traversal-protection)
3. [Rate Limiting](#rate-limiting)
4. [Request Size Limits](#request-size-limits)
5. [HTTPS/TLS Configuration](#httpsttls-configuration)
6. [Authentication & Authorization](#authentication--authorization)
7. [Data Security](#data-security)
8. [Deployment Security](#deployment-security)
9. [Monitoring & Logging](#monitoring--logging)
10. [Incident Response](#incident-response)

---

## Server Hardening (current behaviour)

This section describes what the web server enforces today. Where older sections below differ, this one wins.

### Path confinement

The web server can only read paths inside an allow-list of root directories (`GET /api/config` shows the
active mode under `serverPaths`):

| Setting | Effect |
|---|---|
| `NODE_ENV` unset or `development` | Any absolute path may be analysed (local use). |
| `NODE_ENV=production` | Only `/projects` (mount your R projects there, read-only). |
| `ALLOWED_PROJECT_ROOTS=/a,/b` | Only these directories (comma separated). |
| `ALLOW_ANY_PATH=true` | Opt back in to unrestricted paths. Never do this on a public server. |

When confined, `detect-workflow`, `validate-project` and `validate-file` (v0 and v1) resolve the path with
`realpath` (so symlinks cannot escape), require it to be inside a root and use the resolved path from then on.
A path outside every root, a path that does not exist, `..` traversal, a symlink escape and a relative path all
produce the same response, so the endpoint cannot be used to probe the container filesystem:

```
HTTP 400  {"error":true,"code":"PATH_NOT_ALLOWED","message":"Path is not available on this server"}
```

Residual risk: symbolic links *inside* an allowed project that point outside the root are not followed during
directory traversal, but a project file that is itself such a symlink is read. Mount untrusted projects read-only.

### Response headers

Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation and
FLoC disabled), `Cross-Origin-Opener-Policy: same-origin` and a `Content-Security-Policy` (defined in
`src/middleware/security-headers.ts`, with `frame-ancestors 'none'`). `Strict-Transport-Security` is sent only
for HTTPS requests; behind a TLS-terminating proxy this requires `TRUST_PROXY` so that `X-Forwarded-Proto` is
believed. `X-Powered-By` is disabled. `/api/*`, `/health` and `/metrics*` are `Cache-Control: no-store`.

### Rate limiting

100 requests per minute per client. Every response of a limited route carries `X-RateLimit-Limit`,
`X-RateLimit-Remaining` and `X-RateLimit-Reset`; a `429` adds `Retry-After` (seconds). `/health` is exempt.
The client is Express's `req.ip`. `X-Forwarded-For` and `X-Real-IP` are **ignored** unless `TRUST_PROXY` is set
(a hop count such as `1`, or an Express value such as `loopback`), so a client cannot dodge the limit by
spoofing a header. Behind a reverse proxy you must set `TRUST_PROXY`, otherwise all visitors share the proxy's bucket.
`/metrics/rate-limit` reports salted short hashes, never client addresses.

### Request limits and errors

JSON and form bodies are limited to 1 MB (`MAX_BODY_BYTES` to change); routes that need more declare their own
limit in `LARGE_BODY_ROUTES`. Malformed JSON gives `400 INVALID_JSON`, oversized bodies `413 PAYLOAD_TOO_LARGE`,
unexpected failures `500 INTERNAL_ERROR`; error bodies never contain stack traces or server paths.

### Metrics protection

`/metrics`, `/metrics/rate-limit`, `/metrics/requests.csv` and `/metrics/operations.csv` are public in development.
In production they answer `404` (as if they did not exist) unless `METRICS_TOKEN` is set, in which case they require
`Authorization: Bearer <METRICS_TOKEN>` (constant-time comparison, `401` with `WWW-Authenticate: Bearer` otherwise).
`METRICS_PUBLIC=true` makes them public explicitly. `/health` stays public and exposes only aggregate numbers.

---

## Input Validation & Sanitization

### Implemented Protections

The server validates and sanitizes all user inputs:

- **Path validation**: Enforces 4,096 character limit, rejects null bytes
- **Workflow validation**: Whitelist of 12 valid workflow types
- **String sanitization**: Removes shell metacharacters (<, >, |, ", *, ?)
- **Parameter validation**: Type checking and range validation for all parameters

### Best Practices

**For API Users:**
```bash
# Good: Use forward slashes for paths
curl -X POST http://localhost:3000/api/v1/detect-workflow \
  -H "Content-Type: application/json" \
  -d '{"path": "/home/user/my-project"}'

# Bad: Path traversal attempts are blocked
curl -X POST http://localhost:3000/api/v1/detect-workflow \
  -H "Content-Type: application/json" \
  -d '{"path": "../../../../etc/passwd"}'
# Response: 400 Bad Request - Path traversal detected
```

**For Deployments:**
- Always validate user-supplied paths in your application
- Use the `/api/v1/*` versioned endpoints (security fixes in new versions)
- Never disable path validation
- Keep the server updated for security patches

---

## Path Traversal Protection

### What It Protects Against

Directory traversal attacks try to access files outside the intended directory:

```
../../../etc/passwd      # Relative path traversal
/etc/passwd              # Absolute path (outside project)
..%2F..%2Fetc%2Fpasswd   # URL-encoded traversal
```

### How It Works

1. **Path normalization**: Converts all paths to absolute canonical form
2. **Boundary check**: Ensures resolved path stays within base directory
3. **Rejection**: Returns 400 error for any traversal attempt

### Examples

```typescript
// Safe: Within project
validatePath('/projects/myproject', 'src/file.R')
// ✓ Returns: /projects/myproject/src/file.R

// Blocked: Directory traversal
validatePath('/projects/myproject', '../../../etc/passwd')
// ✗ Throws: "Path traversal detected"

// Blocked: Absolute path outside base
validatePath('/projects/myproject', '/etc/passwd')
// ✗ Throws: "Path traversal detected"
```

---

## Rate Limiting

### Configuration

**Default:** 100 requests per 60 seconds per IP address

**To Change (when running server):**
```typescript
// src/web-server.ts
this.rateLimiter = new RateLimiter(
  60000,  // Window in milliseconds
  100     // Max requests per window
);
```

### Behavior

- **Under limit**: Request succeeds with 200 status
- **At limit**: Headers show remaining requests
- **Exceeded**: Returns 429 "Too Many Requests"

### Response Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2026-09-27T10:30:00.000Z
```

### Tracking

View rate limit statistics:
```bash
curl http://localhost:3000/metrics/rate-limit
```

Response:
```json
{
  "status": "ok",
  "rateLimit": {
    "window": "60 seconds",
    "maxRequests": 100,
    "totalKeys": 12,
    "entries": [
      {
        "key": "192.168.1.100",
        "count": 45,
        "resetTime": "2026-09-27T10:30:00.000Z"
      }
    ]
  }
}
```

### Production Considerations

For high-traffic deployments:

1. **Increase limits** if your workload exceeds 100 req/min
2. **Use load balancer** for rate limiting across multiple instances
3. **Monitor metrics** to detect abusive patterns
4. **Adjust per-use case**:
   - CI/CD pipelines: 200-500 req/min
   - Web dashboard: 50-100 req/min
   - Batch processing: Custom implementation recommended

---

## Request Size Limits

### Configuration

**Default:** 50 MB maximum request body size

**Why It Matters:**
- Prevents memory exhaustion attacks
- Limits impact of malicious large payloads
- Protects server resources

### Behavior

```bash
# Under limit: 10 MB file - succeeds
curl -X POST http://localhost:3000/api/v1/validate-file \
  -H "Content-Type: application/json" \
  -d @file.json  # 10 MB

# Over limit: 60 MB file - fails with 413
curl -X POST http://localhost:3000/api/v1/validate-file \
  -H "Content-Type: application/json" \
  -d @large-file.json  # 60 MB

# Response: 413 Payload Too Large
{
  "error": true,
  "code": "PAYLOAD_TOO_LARGE",
  "message": "Request body exceeds maximum allowed size (50MB)"
}
```

### To Adjust

Edit `src/web-server.ts`:
```typescript
this.app.use(express.json({ limit: '100mb' }));  // Increase limit
```

---

## HTTPS/TLS Configuration

### Development

HTTP is acceptable for local development:
```bash
npm run start:web  # HTTP on port 3000
```

### Production Deployment

**Always use HTTPS with valid certificates:**

#### Option 1: Nginx Reverse Proxy (Recommended)

See [DOCKER.md](./DOCKER.md#ssl-tls-setup) for complete SSL setup with Let's Encrypt.

#### Option 2: Docker with SSL

```bash
# Mount certificate files
docker run -d \
  -p 443:3000 \
  -v /path/to/cert.pem:/app/cert.pem \
  -v /path/to/key.pem:/app/key.pem \
  alexseymer/r-best-practices-mcp:latest
```

#### Option 3: Node.js HTTPS

```typescript
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('/path/to/key.pem'),
  cert: fs.readFileSync('/path/to/cert.pem'),
};

https.createServer(options, app).listen(443);
```

---

## Authentication & Authorization

### Current Implementation

The server does **not** implement authentication by default:
- All endpoints are publicly accessible
- No API keys or tokens required
- Suitable for internal networks or protected deployments

### For Production with Authentication

**Recommended Approaches:**

#### 1. API Key Middleware

```typescript
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !isValidKey(apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

#### 2. OAuth 2.0 / OpenID Connect

Use a reverse proxy (Nginx, CloudFlare) with OAuth integration.

#### 3. Network-Level Access

**Simplest for internal use:**
- Deploy in private network
- Use VPN for remote access
- Firewall rules restrict IP ranges

### Recommended Setup

For self-hosted deployment:

1. **Place behind reverse proxy** (Nginx)
2. **Enable TLS/SSL** with valid certificate
3. **Restrict network access**:
   ```nginx
   allow 10.0.0.0/8;      # Internal network
   deny all;              # Block external access
   ```
4. **Use strong firewall rules**
5. **Monitor access logs** for suspicious patterns

---

## Data Security

### Data Processed

The server processes:
- File system paths (user-provided)
- Project metadata (detected from filesystem)
- Validation findings (in-memory, not persisted)
- Metrics data (performance statistics, in-memory only)

### Data NOT Persisted

By default, the server:
- ✓ Does NOT store any user data
- ✓ Does NOT create database records
- ✓ Does NOT write logs to disk (stdout only)
- ✓ Does NOT cache validation results

### For Persistent Deployments

If you need data persistence (logs, metrics):

**Use read-only access to file paths:**
```docker
docker run -v /path/to/projects:/projects:ro \
  alexseymer/r-best-practices-mcp
```

The `:ro` flag ensures the server can only read, not modify files.

### Metrics Security

The `/metrics` endpoint exposes:
- Request counts and timing
- Operation statistics
- **NOT** file contents or sensitive data

Restrict access if needed:
```nginx
location /metrics {
    allow 10.0.0.0/8;
    deny all;
}
```

---

## Deployment Security

### Docker Best Practices

**✓ What we do:**
- Non-root user for container process
- Multi-stage build (minimal image size)
- Health checks configured
- Signal handling (graceful shutdown)
- Read-only file systems where possible

**✓ What you should do:**

1. **Use specific image versions:**
   ```bash
   docker pull alexseymer/r-best-practices-mcp:0.2.0  # Not :latest
   ```

2. **Run with resource limits:**
   ```bash
   docker run -d \
     --memory=512m \
     --cpus=2 \
     alexseymer/r-best-practices-mcp:0.2.0
   ```

3. **Enable read-only root filesystem:**
   ```bash
   docker run -d \
     --read-only \
     -v /tmp \
     alexseymer/r-best-practices-mcp:0.2.0
   ```

4. **Drop capabilities:**
   ```bash
   docker run -d \
     --cap-drop=ALL \
     --cap-add=NET_BIND_SERVICE \
     alexseymer/r-best-practices-mcp:0.2.0
   ```

### Network Security

**Recommended architecture:**

```
Internet
    ↓
Load Balancer (SSL termination)
    ↓
Reverse Proxy (Rate limiting, auth)
    ↓
Application Server (Internal network only)
    ↓
File System (Read-only volumes)
```

See [DOCKER.md](./DOCKER.md) for complete examples.

---

## Monitoring & Logging

### Built-in Monitoring

The server provides:

1. **Health check endpoint:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Metrics endpoint:**
   ```bash
   curl http://localhost:3000/metrics
   ```

3. **Rate limit statistics:**
   ```bash
   curl http://localhost:3000/metrics/rate-limit
   ```

### Logging Strategy

Server logs to stdout (12-factor app pattern):

```bash
# Run with log output
docker run -it alexseymer/r-best-practices-mcp:latest

# Capture logs
docker logs -f container_id

# Send to logging service
docker run -d \
  --log-driver=awslogs \
  --log-opt awslogs-group=/ecs/r-practices \
  alexseymer/r-best-practices-mcp:latest
```

### Security Events to Monitor

1. **Rate limit exceeded (429 responses)**
   - Indicates potential DoS attempt
   - Check `/metrics/rate-limit` for suspicious IPs

2. **Path validation failures (400 responses)**
   - May indicate directory traversal attempts
   - Review error logs for patterns

3. **Unusual request patterns**
   - Spike in errors
   - Repeated failed validations
   - High request rates from single IP

---

## Incident Response

### Security Issue Reporting

If you discover a security vulnerability:

1. **Do NOT open a public issue**
2. **Email**: alexseymer@gmail.com with details
3. **Include**: Version, reproduction steps, impact assessment
4. **Responsible disclosure**: Allow time for patches before public disclosure

### Recovery Procedures

**If compromised (unlikely, but for completeness):**

1. **Stop the service:**
   ```bash
   docker stop r-practices
   ```

2. **Audit logs:**
   ```bash
   docker logs r-practices > audit.log
   ```

3. **Review access patterns:**
   - Check what files were accessed
   - Verify no unauthorized changes

4. **Update image:**
   ```bash
   docker pull alexseymer/r-best-practices-mcp:latest
   docker run -d alexseymer/r-best-practices-mcp:latest
   ```

5. **Verify integrity:**
   ```bash
   curl http://localhost:3000/health
   ```

---

## Security Checklist for Production

- [ ] TLS/SSL configured with valid certificate
- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Rate limiting configured appropriately
- [ ] Network access restricted (firewall rules)
- [ ] Docker resource limits set
- [ ] Non-root container user confirmed
- [ ] Read-only file systems enabled where possible
- [ ] Health checks monitored
- [ ] Logs aggregated and monitored
- [ ] Metrics endpoint access restricted
- [ ] Regular security updates applied
- [ ] Incident response plan documented

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [12-Factor App Security](https://12factor.net/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Last Updated:** 2026-09-27  
**Security Level:** Production-Ready  
**Questions?** Open an issue or contact the maintainers
