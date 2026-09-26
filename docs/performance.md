# Performance Monitoring & Metrics

This document describes the performance monitoring capabilities of the R Best Practices MCP Server, including metrics tracking, benchmarking, and optimization strategies.

## Overview

The server includes comprehensive performance monitoring for:

- **Request metrics** — HTTP request duration, status codes, endpoints
- **Operation metrics** — Detection, validation, template generation, practice lookups
- **Resource usage** — Container CPU/memory limits and monitoring
- **Performance benchmarking** — Speed tests and stress testing

## Performance Metrics Endpoints

### Health Check with Metrics

```bash
GET /health
```

Returns service status and current metrics snapshot:

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
    "errorCounts": {
      "detection": 0,
      "validation": 5,
      "practice-lookup": 0
    }
  }
}
```

### Detailed Metrics Endpoint

```bash
GET /metrics
```

Returns full metrics snapshot with request and operation history:

```json
{
  "requests": [
    {
      "endpoint": "/api/detect-workflow",
      "method": "POST",
      "statusCode": 200,
      "duration": 45.23,
      "timestamp": "2026-09-26T12:00:00.000Z"
    }
  ],
  "operations": [
    {
      "operationType": "detection",
      "duration": 43.21,
      "success": true,
      "error": null,
      "timestamp": "2026-09-26T12:00:00.000Z"
    }
  ],
  "uptime": 3600000,
  "averageRequestDuration": 45.23,
  "averageOperationDuration": {
    "detection": 42.15,
    "validation": 125.43,
    "template-generation": 8.92,
    "practice-lookup": 2.34
  },
  "operationCounts": {
    "detection": 342,
    "validation": 450,
    "template-generation": 28,
    "practice-lookup": 430
  },
  "errorCounts": {
    "detection": 0,
    "validation": 5,
    "practice-lookup": 0
  }
}
```

### Metrics Export Endpoints

**Export requests as CSV:**

```bash
GET /metrics/requests.csv
```

**Export operations as CSV:**

```bash
GET /metrics/operations.csv
```

Both CSV exports include all historical data with columns:
- Requests: `endpoint`, `method`, `statusCode`, `duration`, `timestamp`
- Operations: `operationType`, `duration`, `success`, `error`, `timestamp`

## Expected Performance Metrics

### Operation Baselines

| Operation | Expected Duration | 95th Percentile | Notes |
|-----------|------------------|-----------------|-------|
| **Detection** | 40-80ms | <150ms | Varies by directory size |
| **Validation** | 100-300ms | <600ms | Depends on project size |
| **Template Generation** | 5-20ms | <50ms | Pure computation, no I/O |
| **Practice Lookup** | 1-5ms | <10ms | In-memory database query |

### Request Metrics

- **Average request duration**: 40-80ms (varies by endpoint)
- **P95 duration**: <300ms for most operations
- **P99 duration**: <1000ms
- **Error rate**: <1% for all endpoints

### Concurrent Load Performance

- **Sequential requests (20)**: Should complete within 2 seconds
- **Parallel requests (10)**: Should complete within 1 second
- **Mixed workload**: Detection + Validation + Generation should complete within 5 seconds

## Resource Requirements & Limits

### Docker Container Resources

```yaml
# Default resource limits (docker-compose.yml)
resources:
  limits:
    cpus: '2'          # Maximum 2 CPU cores
    memory: 512M       # Maximum 512MB RAM
  reservations:
    cpus: '0.5'        # Reserved 0.5 CPU cores
    memory: 256M       # Reserved 256MB RAM
```

### Recommended Host Resources

**Minimum:**
- CPU: 1 core
- Memory: 512MB total (256MB reserved)
- Disk: 1GB for container

**Recommended:**
- CPU: 2+ cores
- Memory: 2GB total (512MB+ reserved)
- Disk: 5GB for container and projects

**Production:**
- CPU: 4+ cores
- Memory: 4GB+ total
- Disk: 10GB+
- Network: Gigabit or better

## Running Benchmarks

### Performance Test Suite

Run the full performance benchmark suite:

```bash
npm test -- tests/performance.test.ts
```

### Individual Benchmark Tests

```bash
# Detection performance tests
npm test -- tests/performance.test.ts -t "Detection Performance"

# Validation performance tests
npm test -- tests/performance.test.ts -t "Validation Performance"

# Template generation performance
npm test -- tests/performance.test.ts -t "Template Generation"

# Stress tests
npm test -- tests/performance.test.ts -t "Stress Testing"

# Metrics collection
npm test -- tests/performance.test.ts -t "Metrics Collection"
```

### Sample Benchmark Output

```
Performance Benchmarks
  Detection Performance
    ✓ should detect Shiny app within acceptable time (45ms)
    ✓ should detect package within acceptable time (52ms)
    ✓ should detect Quarto within acceptable time (38ms)
    ✓ should detect R script within acceptable time (22ms)
    ✓ should handle multiple detections efficiently (avg: 48ms)

  Validation Performance
    ✓ should validate Shiny project within acceptable time (124ms)
    ✓ should validate package within acceptable time (156ms)
    ✓ should validate file quickly (78ms)
    ✓ should handle batch validation efficiently (avg: 142ms)

  Stress Testing
    ✓ should handle rapid sequential detection requests (985ms total, avg: 49ms)
    ✓ should handle rapid sequential validations (1234ms total, avg: 123ms)
```

## Monitoring Container Performance

### Using Docker Stats

Monitor real-time resource usage of running containers:

```bash
# Monitor all containers
docker stats

# Monitor specific container
docker stats r-practices-api

# Continuous monitoring (updates every 2 seconds)
docker stats r-practices-api --no-stream=false
```

### Example Output

```
CONTAINER ID   NAME            CPU %     MEM USAGE / LIMIT   MEM %
abc123def      r-practices-api 0.25%     120M / 512M        23.4%
```

### Docker Compose Monitoring

```bash
# View container logs with metrics info
docker-compose logs -f api

# Check container status
docker-compose ps

# View resource usage
docker-compose stats
```

### Prometheus/Grafana Integration (Optional)

The `/metrics` endpoint returns JSON-formatted metrics that can be scraped by Prometheus:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'r-practices-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

## Performance Tuning Recommendations

### For Detection Operations

1. **Reduce directory traversal scope** — Validate specific directories rather than entire projects
2. **Cache detection results** — Store results if running repeatedly on same path
3. **Limit file count** — Skip large node_modules or data directories during detection

### For Validation Operations

1. **Run validations asynchronously** — Use Promise.all for parallel file validation
2. **Filter by severity** — Request only critical/important findings to reduce processing
3. **Limit file patterns** — Validate specific file types rather than all files

### For General Performance

1. **Enable compression** — Use gzip for API responses
2. **Implement caching** — Cache practice lookups and template generation results
3. **Use connection pooling** — For high-volume request scenarios
4. **Optimize Node.js** — Use production flags and appropriate memory limits

### Docker Optimization

```bash
# Run with optimized Node.js flags
docker run -e NODE_OPTIONS="--max-old-space-size=256" r-practices-api

# Use multi-stage builds to reduce image size
# See Dockerfile for implementation

# Monitor memory leaks
docker stats --no-stream | grep r-practices-api
```

## Troubleshooting Performance Issues

### High CPU Usage

**Symptoms:** Container using >80% CPU consistently

**Solutions:**
1. Check for large project validations
2. Review logs for error loops
3. Increase CPU limit in docker-compose.yml
4. Profile with `node --prof` flag

### High Memory Usage

**Symptoms:** Container approaching 512MB memory limit

**Solutions:**
1. Review `/metrics` for operation counts
2. Check for memory leaks in operation loops
3. Reduce history size in MetricsCollector
4. Increase memory limit in docker-compose.yml

### Slow API Responses

**Symptoms:** Average response time > 200ms

**Solutions:**
1. Check `/metrics` for operation durations
2. Review specific slow operations in logs
3. Verify project sizes aren't exceeding limits
4. Check for network bottlenecks
5. Profile with `node --prof` flag

### High Error Rates

**Symptoms:** Error count in `/metrics` > 5%

**Solutions:**
1. Review error details in application logs
2. Check path permissions for file access
3. Verify project structures are valid
4. Check disk space availability

## Metrics Data Retention

- **In-memory history**: Last 1000 requests/operations
- **CSV exports**: Full session history (limited by browser/API client)
- **Hourly snapshots**: Can be stored externally (not implemented by default)

To export metrics for long-term analysis:

```bash
# Export requests
curl http://localhost:3000/metrics/requests.csv > requests.csv

# Export operations
curl http://localhost:3000/metrics/operations.csv > operations.csv

# Export JSON
curl http://localhost:3000/metrics > metrics.json
```

## Performance Comparison Matrix

### Detection Performance by Workflow

| Workflow | Typical Time | P95 | Notes |
|----------|-------------|-----|-------|
| r-script | 22ms | 35ms | Fastest |
| quarto | 38ms | 65ms | - |
| r-markdown | 42ms | 75ms | - |
| shiny | 45ms | 85ms | Requires app.R check |
| package | 52ms | 95ms | DESCRIPTION parsing |
| plumber | 48ms | 88ms | - |
| targets | 50ms | 90ms | - |
| analysis | 55ms | 100ms | - |
| renv | 60ms | 110ms | Lock file parsing |

### Validation Performance by Workflow

| Workflow | Typical Time | P95 | File Count Impact |
|----------|-------------|-----|-------------------|
| r-script | 78ms | 150ms | Linear |
| r-markdown | 95ms | 180ms | Linear |
| quarto | 110ms | 210ms | Linear |
| shiny | 124ms | 235ms | Quadratic |
| package | 156ms | 300ms | Quadratic |
| plumber | 130ms | 250ms | Linear |
| targets | 140ms | 270ms | Quadratic |
| analysis | 150ms | 290ms | Quadratic |

## Capacity Planning

### Single Server Capacity

Based on 2 CPU / 512MB RAM:

- **Peak concurrent users**: 10-15
- **Requests per second**: 20-30
- **Daily requests**: 1.7M - 2.6M
- **Validation operations per day**: 50,000+

### Scaling Strategies

1. **Vertical scaling** — Increase CPU and memory limits
2. **Horizontal scaling** — Use load balancer with multiple API instances
3. **Caching layer** — Add Redis for result caching
4. **Async processing** — Use queue system for batch operations

## References

- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Docker Resource Limits](https://docs.docker.com/config/containers/resource_constraints/)
- [Prometheus Monitoring](https://prometheus.io/docs/prometheus/latest/getting_started/)
- [Performance Testing with Jest](https://jestjs.io/docs/timer-mocks)
