# Docker Deployment Guide

This guide explains how to deploy the R Best Practices MCP Server using Docker and docker-compose.

## Quick Start

### Prerequisites

- Docker 20.10+
- docker-compose 2.0+
- Git

### One-Command Deployment

```bash
# Clone the repository
git clone https://github.com/alexseymer/r-best-practice-mcp.git
cd r-best-practice-mcp

# Start the services
docker-compose up -d

# Verify it's running
curl http://localhost:3000/health

# View logs
docker-compose logs -f api
```

The API will be available at `http://localhost:3000`.

## Architecture

```
┌──────────────────────────────────────────┐
│        docker-compose (Orchestration)    │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │   API Service (Node.js + Express)  │  │
│  │   Port: 3000                       │  │
│  │   - Validation endpoints           │  │
│  │   - Detection endpoints            │  │
│  │   - Template generation            │  │
│  │   - Health checks                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │   Nginx (Optional Reverse Proxy)   │  │
│  │   Ports: 80, 443                   │  │
│  │   - SSL/TLS termination            │  │
│  │   - Rate limiting                  │  │
│  │   - Security headers               │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Services

### API Service

The main Node.js Express application exposing 6 REST endpoints.

**Environment Variables:**
- `NODE_ENV` - Environment mode (production/development, default: production)
- `PORT` - Server port (default: 3000)
- `LOG_LEVEL` - Logging level (debug/info/warn/error, default: info)

**Ports:**
- `3000` - API server

**Health Check:**
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "service": "r-best-practices-mcp",
  "version": "1.0.0",
  "timestamp": "2026-09-26T12:34:56.789Z"
}
```

### Nginx Service (Optional)

Reverse proxy for production deployments with SSL support.

**Enabled by:**
```bash
docker-compose --profile with-proxy up -d
```

**Ports:**
- `80` - HTTP (redirects to HTTPS in production config)
- `443` - HTTPS (requires SSL certificates)

## API Endpoints

All endpoints are available at `/api/`:

### 1. Detect Workflow

**POST** `/api/detect-workflow`

Detect the R workflow type from a directory.

Request:
```json
{
  "path": "/path/to/project"
}
```

Response:
```json
{
  "error": false,
  "data": {
    "workflow": "package",
    "confidence": 95,
    "indicators": ["DESCRIPTION", "NAMESPACE", "R/", "tests/"]
  },
  "timestamp": 1695728096789
}
```

### 2. Validate Project

**POST** `/api/validate-project`

Validate an R project against best practices.

Request:
```json
{
  "path": "/path/to/project",
  "workflow": "package"
}
```

Response:
```json
{
  "error": false,
  "data": {
    "workflow": "package",
    "findings": [
      {
        "id": "package-readme",
        "severity": "important",
        "category": "documentation",
        "message": "Package missing README.md",
        "suggestions": ["Add a comprehensive README.md file"]
      }
    ],
    "summary": {
      "total": 5,
      "critical": 1,
      "important": 2,
      "recommended": 2,
      "info": 0
    }
  },
  "timestamp": 1695728096789
}
```

### 3. Validate File

**POST** `/api/validate-file`

Validate a single R or Quarto file.

Request:
```json
{
  "path": "/path/to/script.R"
}
```

Response:
```json
{
  "error": false,
  "data": {
    "path": "/path/to/script.R",
    "findings": [
      {
        "id": "script-header",
        "severity": "important",
        "category": "documentation",
        "message": "R script should include a header",
        "line": 1
      }
    ]
  },
  "timestamp": 1695728096789
}
```

### 4. Get Practice

**GET** `/api/practice/:id`

Get details about a specific best practice.

Request:
```bash
curl http://localhost:3000/api/practice/package-roxygen2
```

Response:
```json
{
  "error": false,
  "data": {
    "id": "package-roxygen2",
    "title": "Use roxygen2 for Documentation",
    "workflow": "package",
    "category": "documentation",
    "severity": "critical",
    "description": "roxygen2 automates documentation management...",
    "examples": ["#' Description", "#' @param x Parameter", "#' @export"]
  },
  "timestamp": 1695728096789
}
```

### 5. List Practices

**GET** `/api/practices?workflow=package&category=documentation`

List best practices filtered by workflow and category.

Query Parameters:
- `workflow` - Filter by workflow type (optional)
- `category` - Filter by category (optional)

Response:
```json
{
  "error": false,
  "data": {
    "practices": [
      {
        "id": "package-roxygen2",
        "title": "Use roxygen2 for Documentation",
        "workflow": "package",
        "category": "documentation",
        "severity": "critical"
      }
    ],
    "count": 12,
    "total": 52
  },
  "timestamp": 1695728096789
}
```

### 6. Generate Template

**POST** `/api/generate-template`

Generate a project template for a specific R workflow.

Request:
```json
{
  "workflow": "package",
  "projectName": "mypackage",
  "authorName": "John Doe",
  "authorEmail": "john@example.com"
}
```

Response:
```json
{
  "error": false,
  "data": {
    "workflow": "package",
    "files": [
      {
        "path": "DESCRIPTION",
        "content": "Package: mypackage\nTitle: Package Title\n..."
      },
      {
        "path": "R/main.R",
        "content": "#' Function Description\n#' @export\nmain <- function() { }"
      }
    ],
    "directories": ["R", "tests", "man"]
  },
  "timestamp": 1695728096789
}
```

### 7. List Tools

**GET** `/api/tools`

Get documentation for all available API endpoints.

## Configuration

### Basic Configuration

Edit `docker-compose.yml` to modify:

```yaml
services:
  api:
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=info
    ports:
      - "3000:3000"
```

### Mounting Project Directories

By default, the container has access to `/projects`. Mount your project directories:

```yaml
services:
  api:
    volumes:
      - /path/to/your/projects:/projects:ro
```

Then validate projects:
```bash
curl -X POST http://localhost:3000/api/validate-project \
  -H "Content-Type: application/json" \
  -d '{"path": "/projects/my-package"}'
```

### Production Configuration with SSL

1. **Install Nginx profile:**
```bash
docker-compose --profile with-proxy up -d
```

2. **Configure SSL certificates:**
```bash
# Using Let's Encrypt Certbot
sudo certbot certonly --standalone -d your-domain.com

# Update nginx.conf with certificate paths
# Uncomment SSL configuration sections
```

3. **Rebuild and restart:**
```bash
docker-compose down
docker-compose --profile with-proxy up -d
```

## Common Operations

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api

# Last 100 lines
docker-compose logs -f --tail 100 api
```

### Stop Services

```bash
# Stop but keep containers
docker-compose stop

# Stop and remove containers
docker-compose down

# Remove containers, networks, and volumes
docker-compose down -v
```

### Restart Services

```bash
# Restart specific service
docker-compose restart api

# Restart all services
docker-compose restart
```

### Execute Commands

```bash
# Run command in container
docker-compose exec api node --version

# Open shell
docker-compose exec api sh
```

### View Container Stats

```bash
# Real-time resource usage
docker stats r-practices-api

# Memory and CPU
docker container stats --no-stream
```

## Troubleshooting

### Container Won't Start

Check logs:
```bash
docker-compose logs api
```

Common issues:
- **Port 3000 already in use:** Change port in docker-compose.yml
- **Out of disk space:** Run `docker system prune -a`
- **Permission denied:** Ensure Docker daemon is running

### API Not Responding

Verify health check:
```bash
curl http://localhost:3000/health
```

If 404 or timeout:
- Container may still be starting (wait 30s)
- Check logs: `docker-compose logs api`
- Verify port mapping: `docker-compose ps`

### Validation Failing

Ensure project paths are mounted:
```bash
# Check mounts
docker inspect r-practices-api | grep -A 10 Mounts

# Verify path in container
docker-compose exec api ls /projects/
```

### High Memory Usage

Reduce build cache:
```bash
docker system prune --all
docker-compose build --no-cache
```

## Performance Tuning

### Resource Limits

Edit `docker-compose.yml`:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Nginx Caching

Edit `nginx.conf` to enable caching:

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;

location /api/practices {
    proxy_cache api_cache;
    proxy_cache_valid 200 1h;
    ...
}
```

## Security

### Best Practices

1. **Don't expose to untrusted networks:**
   - Use firewall rules
   - Run behind VPN
   - Use TLS certificates

2. **Limit file access:**
   - Mount directories as read-only (`:ro`)
   - Use absolute paths
   - Validate input paths

3. **Monitor and log:**
   - Enable nginx access logs
   - Monitor memory/CPU usage
   - Set up alerts for errors

4. **Keep updated:**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Environment Variables

Never hardcode secrets:
```bash
# Create .env file (add to .gitignore)
NODE_ENV=production
PORT=3000

# Use in docker-compose
docker-compose --env-file .env up -d
```

## Deployment

### Development

```bash
docker-compose -f docker-compose.yml up
```

### Production

```bash
# Build optimized image
docker-compose build --no-cache

# Run with Nginx proxy
docker-compose --profile with-proxy up -d

# Set up monitoring
docker-compose logs -f
```

### CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy
        run: |
          docker-compose build --no-cache
          docker-compose up -d
```

## Resource Monitoring

The server includes comprehensive performance metrics and monitoring endpoints.

### Metrics Endpoints

**Health Check with Metrics:**
```bash
curl http://localhost:3000/health
```

Response includes uptime, average request duration, and operation counts:
```json
{
  "status": "ok",
  "service": "r-best-practices-mcp",
  "version": "1.0.0",
  "timestamp": "2026-09-26T12:00:00.000Z",
  "metrics": {
    "uptime": 3600000,
    "averageRequestDuration": "45.23ms",
    "totalRequests": 1250,
    "operationCounts": {
      "detection": 342,
      "validation": 450,
      "template-generation": 28,
      "practice-lookup": 430
    },
    "errorCounts": {}
  }
}
```

**Detailed Metrics:**
```bash
curl http://localhost:3000/metrics
```

Returns full metrics snapshot with request and operation history.

**Export Metrics as CSV:**
```bash
# Export request metrics
curl http://localhost:3000/metrics/requests.csv > requests.csv

# Export operation metrics
curl http://localhost:3000/metrics/operations.csv > operations.csv
```

### Docker Stats Monitoring

**Real-time resource usage:**
```bash
# Monitor all containers
docker stats

# Monitor specific container
docker stats r-practices-api

# Continuous monitoring
docker stats r-practices-api --no-stream=false
```

**Example output:**
```
CONTAINER ID   NAME            CPU %     MEM USAGE / LIMIT   MEM %
abc123def      r-practices-api 0.25%     120M / 512M        23.4%
```

### Docker Compose Stats

```bash
# View all container stats
docker-compose stats

# Follow logs with timing info
docker-compose logs -f --timestamps api
```

### Resource Limits

The docker-compose.yml includes resource limits to prevent resource exhaustion:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'           # Maximum 2 CPU cores
      memory: 512M        # Maximum 512MB RAM
    reservations:
      cpus: '0.5'         # Reserved 0.5 CPU cores
      memory: 256M        # Reserved 256MB RAM
```

**Modifying limits:**

Edit `docker-compose.yml`:
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '4'          # Increase CPU limit
          memory: 1024M      # Increase memory limit
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

### Performance Benchmarks

Run performance tests to establish baselines:

```bash
# Run all performance tests
npm test -- tests/performance.test.ts

# Specific test categories
npm test -- tests/performance.test.ts -t "Detection Performance"
npm test -- tests/performance.test.ts -t "Stress Testing"
```

**Expected Performance:**
| Operation | Typical Time | P95 | Limit |
|-----------|-------------|-----|-------|
| Detection | 40-80ms | <150ms | 1000ms |
| Validation | 100-300ms | <600ms | 2000ms |
| Template Generation | 5-20ms | <50ms | 500ms |
| Practice Lookup | 1-5ms | <10ms | 100ms |

### Monitoring Best Practices

1. **Check health regularly:**
   ```bash
   watch -n 5 'curl -s http://localhost:3000/health | jq .metrics'
   ```

2. **Monitor resource usage:**
   ```bash
   watch -n 2 'docker stats r-practices-api --no-stream'
   ```

3. **Export and analyze metrics:**
   ```bash
   # Export metrics periodically
   curl http://localhost:3000/metrics > metrics-$(date +%s).json
   
   # Store in time-series database or file
   ```

4. **Set up alerts for high resource usage:**
   ```bash
   # Example: Alert if memory exceeds 400MB
   docker stats --no-stream | grep r-practices-api | awk '{print $3}' | grep -q "4[0-9][0-9]M"
   ```

### Prometheus Integration (Optional)

The `/metrics` endpoint returns JSON that can be used with Prometheus:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'r-practices-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

See [Performance Documentation](/docs/performance.md) for detailed monitoring guidelines.

## Scaling

For multiple instances:

```yaml
services:
  api-1:
    build: .
    ports:
      - "3001:3000"
  
  api-2:
    build: .
    ports:
      - "3002:3000"
  
  nginx:
    # Proxies to both instances
```

## Support

For issues or questions:
- Check logs: `docker-compose logs api`
- Review [API Documentation](/docs/tutorials/01-mcp-integration.md)
- File an issue: https://github.com/alexseymer/r-best-practice-mcp/issues

## Next Steps

1. ✅ Run `docker-compose up`
2. ✅ Test health endpoint: `curl http://localhost:3000/health`
3. ✅ Try an API call: `curl http://localhost:3000/api/tools`
4. ✅ Mount your projects and validate
5. ✅ Integrate with CI/CD

---

Last updated: 2026-09-26
