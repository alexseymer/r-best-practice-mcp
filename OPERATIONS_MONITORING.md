# Operations & Monitoring Guide

## Overview

This guide covers monitoring, logging, and operational best practices for running the R Best Practices MCP Server in production.

---

## Monitoring Strategy

### Key Metrics to Track

#### 1. **Request Metrics**
- **Request rate** — Requests per second (should be < 100 req/60s per IP)
- **Response time** — p50, p95, p99 latencies
- **Error rate** — 5xx responses as % of total
- **Status code distribution** — Breakdown by 2xx, 4xx, 5xx

#### 2. **Operation Metrics**
- **Detection latency** — Time to detect workflow (target: <100ms)
- **Validation latency** — Time to validate project (target: <500ms)
- **Template generation latency** — Time to generate scaffold (target: <10ms)
- **Practice lookup latency** — Time to query knowledge base (target: <5ms)

#### 3. **System Metrics**
- **Memory usage** — Should not exceed 512MB (default limit)
- **CPU usage** — Should not exceed 80% consistently
- **Disk space** — Ensure >10% free space
- **Uptime** — Should be 99.9%+ in production

#### 4. **Security Metrics**
- **Rate limit violations** — 429 responses (indicates attacks or misconfiguration)
- **Path traversal attempts** — 400 responses from path validation
- **Input validation failures** — Rejected requests with invalid input
- **Failed authentications** — 401 responses (if auth enabled)

### Built-in Monitoring Endpoints

#### Health Check Endpoint

```bash
# Check server health with detailed metrics
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "R Best Practices MCP Server",
  "version": "0.3.0",
  "timestamp": "2026-09-27T10:30:00.000Z",
  "metrics": {
    "uptime": 3600000,
    "memory": {
      "used": 128,
      "total": 512,
      "percentage": 25
    },
    "requests": {
      "total": 1250,
      "success": 1225,
      "failed": 25,
      "errorRate": 0.02
    },
    "operations": {
      "detection": { "count": 450, "avgDuration": 85 },
      "validation": { "count": 500, "avgDuration": 250 },
      "template": { "count": 200, "avgDuration": 8 },
      "practice": { "count": 100, "avgDuration": 3 }
    }
  }
}
```

#### Metrics Endpoint

```bash
# Get full metrics snapshot
curl http://localhost:3000/metrics
```

**Response includes:**
- Request metrics (last 100 requests)
- Operation metrics (last 100 operations)
- Average response times by endpoint
- Percentile latencies (p95, p99)
- Error counts by type

#### Rate Limit Statistics

```bash
# Check rate limit status by IP
curl http://localhost:3000/metrics/rate-limit
```

**Response:**
```json
{
  "status": "ok",
  "rateLimit": {
    "window": "60 seconds",
    "maxRequests": 100,
    "totalKeys": 3,
    "entries": [
      {
        "key": "192.168.1.100",
        "count": 45,
        "resetTime": "2026-09-27T10:31:00.000Z"
      }
    ]
  }
}
```

---

## Structured Logging

### Log Format

The server supports two log formats:

#### Human-Readable Format (Default)
```
2026-09-27T10:30:00.000Z [INFO ] HTTP Request | {"method":"GET","path":"/health","statusCode":200,"durationMs":45}
2026-09-27T10:30:01.000Z [WARN ] Rate Limit Approaching | {"clientIp":"192.168.1.100","remaining":5}
2026-09-27T10:30:02.000Z [ERROR] Validation Failed | Error: ValidationError - Invalid path
```

#### JSON Format (Production)
```json
{
  "timestamp": "2026-09-27T10:30:00.000Z",
  "level": "info",
  "message": "HTTP Request",
  "context": {
    "method": "GET",
    "path": "/health",
    "statusCode": 200,
    "durationMs": 45,
    "type": "http_request"
  }
}
```

### Enabling JSON Logging

**Via environment variable:**
```bash
LOG_FORMAT=json node dist/web-server-entry.js
```

**Via Docker:**
```bash
docker run -e LOG_FORMAT=json \
  alexseymer/r-best-practices-mcp:0.3.0
```

**Via Docker Compose:**
```yaml
services:
  app:
    environment:
      LOG_FORMAT: json
```

### Log Levels

Configure via environment variable:

```bash
# Default: info
LOG_LEVEL=debug npm run start:web    # Verbose debugging
LOG_LEVEL=info npm run start:web     # Standard operation
LOG_LEVEL=warn npm run start:web     # Warnings and errors only
LOG_LEVEL=error npm run start:web    # Errors only
```

### Log Aggregation

#### Sending to CloudWatch (AWS)

```bash
docker run -d \
  -p 3000:3000 \
  --log-driver=awslogs \
  --log-opt awslogs-group=/ecs/r-best-practices-mcp \
  --log-opt awslogs-region=us-east-1 \
  --log-opt awslogs-stream=server-$(date +%s) \
  alexseymer/r-best-practices-mcp:0.3.0
```

#### Sending to ELK Stack (Elasticsearch)

**Using Filebeat:**
```yaml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/r-best-practices/*.log
  json.message_key: message
  json.keys_under_root: true
  json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "r-best-practices-%{+yyyy.MM.dd}"
```

#### Sending to Splunk

```bash
docker run -d \
  -p 3000:3000 \
  --log-driver=splunk \
  --log-opt splunk-token=<HEC_TOKEN> \
  --log-opt splunk-url=https://splunk.example.com:8088 \
  --log-opt splunk-format=json \
  alexseymer/r-best-practices-mcp:0.3.0
```

---

## Alerting Rules

### Critical Alerts

**1. Service Down**
```
IF health_check FAILS for 1 minute
THEN alert "Service is down"
```

**2. High Error Rate**
```
IF error_rate > 5% over 5 minutes
THEN alert "High error rate detected"
```

**3. Memory Critical**
```
IF memory_usage > 90% of limit
THEN alert "Memory usage critical"
```

**4. Under Attack (Rate Limit Exhaustion)**
```
IF rate_limit_violations > 10 per minute
THEN alert "Possible DoS attack"
```

### Warning Alerts

**1. High Latency**
```
IF p95_response_time > 1000ms over 5 minutes
THEN warn "High response latencies"
```

**2. Path Traversal Attempts**
```
IF path_validation_failures > 5 per minute
THEN warn "Multiple path traversal attempts detected"
```

**3. Input Validation Failures**
```
IF input_validation_failures > 20 per hour
THEN warn "High rate of validation failures"
```

### Example Prometheus Rules

```yaml
groups:
  - name: r_best_practices
    rules:
      - alert: ServiceDown
        expr: up{job="r-best-practices"} == 0
        for: 1m
        annotations:
          summary: "R Best Practices service is down"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "Error rate is {{ $value }}"

      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes{container="app"} / 512000000 > 0.9
        for: 2m
        annotations:
          summary: "Memory usage at {{ $value | humanizePercentage }}"

      - alert: RateLimitExhaustion
        expr: rate(http_requests_total{status="429"}[1m]) > 10
        for: 1m
        annotations:
          summary: "{{ $value }} rate limit violations per minute"
```

---

## Performance Optimization

### Request Caching

Enable response caching at the reverse proxy:

**Nginx Configuration:**
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;

location /api/practices {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_pass http://app:3000;
}

location /api/v1/practice/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 1h;
    proxy_pass http://app:3000;
}
```

### Load Balancing

**Nginx upstream with health checks:**
```nginx
upstream app {
    server app1:3000 weight=1 max_fails=3 fail_timeout=30s;
    server app2:3000 weight=1 max_fails=3 fail_timeout=30s;
    server app3:3000 weight=1 max_fails=3 fail_timeout=30s;

    check interval=3000 rise=2 fall=5 timeout=1000 type=http;
    check_http_send "GET /health HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx;
}
```

### Connection Pooling

Ensure Node.js connection pooling is enabled:

```bash
# Increase file descriptor limit
ulimit -n 65536

# Set environment variables
NODE_ENV=production
NODE_OPTIONS="--max-http-header-size=16384"
```

---

## Operational Tasks

### Daily Operations

**Morning Check (Daily 8am)**
```bash
# Check service health
curl http://localhost:3000/health | jq '.status'

# Check error rate
curl http://localhost:3000/metrics | jq '.requests | {total, failed, errorRate}'

# Check rate limit status
curl http://localhost:3000/metrics/rate-limit | jq '.rateLimit'
```

**Response Time Monitoring (Hourly)**
```bash
# Monitor latencies
curl http://localhost:3000/health | jq '.metrics.operations'
```

### Weekly Operations

**Performance Review**
1. Analyze latency trends
2. Review error logs for patterns
3. Check disk space usage
4. Verify backup integrity

**Security Review**
1. Check rate limit violations
2. Review path traversal attempts
3. Look for unusual access patterns
4. Verify access logs

### Monthly Operations

**Maintenance**
1. Update dependencies: `npm update`
2. Run security audit: `npm audit`
3. Review and compress logs
4. Update monitoring dashboards
5. Performance capacity planning

**Compliance**
1. Review access logs for compliance
2. Verify data retention policies
3. Test disaster recovery procedures
4. Update runbooks and documentation

### Quarterly Operations

**Major Reviews**
1. Full security audit
2. Capacity planning and right-sizing
3. Disaster recovery drill
4. Dependency update strategy review
5. Performance benchmarking

---

## Troubleshooting

### High Memory Usage

**Symptoms:** Memory approaching 512MB limit

**Diagnosis:**
```bash
# Check memory usage
docker stats container_id

# Get memory metrics
curl http://localhost:3000/health | jq '.metrics.memory'

# Check for memory leaks in logs
docker logs container_id | grep -i memory
```

**Solutions:**
1. Increase container memory limit
2. Restart service (graceful shutdown)
3. Reduce `maxOperations` in metrics collector
4. Check for malformed requests

### High Response Latency

**Symptoms:** Response times > 1000ms

**Diagnosis:**
```bash
# Get latency metrics
curl http://localhost:3000/metrics | jq '.operations | .[] | select(.avgDuration > 1000)'

# Check error patterns
curl http://localhost:3000/metrics | jq '.requests | .[] | select(.duration > 1000)'
```

**Solutions:**
1. Reduce project size for validation
2. Add response caching at reverse proxy
3. Increase CPU allocation
4. Check for disk I/O bottlenecks

### Excessive Errors

**Symptoms:** Error rate > 1%

**Diagnosis:**
```bash
# Get error breakdown
curl http://localhost:3000/metrics | jq '.errorCounts'

# Check logs for error patterns
docker logs container_id | grep ERROR | tail -20
```

**Solutions:**
1. Review error messages in logs
2. Check if requests are malformed
3. Verify path permissions
4. Check rate limit status

### Rate Limit Issues

**Symptoms:** Getting 429 responses

**Diagnosis:**
```bash
# Check rate limit stats
curl http://localhost:3000/metrics/rate-limit

# Check your request rate
# (count requests from your IP in last 60 seconds)
```

**Solutions:**
1. Slow down request rate
2. Use pagination for bulk operations
3. Implement client-side caching
4. Contact operator to increase limit (if justified)

---

## Backup & Recovery

### Backing Up Configuration

```bash
# Export current configuration
docker inspect r-practices > config-backup.json

# Export environment variables
docker inspect r-practices | jq '.[] | .Config.Env' > env-backup.json

# Export metrics snapshot
curl http://localhost:3000/metrics > metrics-backup.json
```

### Disaster Recovery

**1. Quick Recovery (< 5 minutes)**
```bash
# Restart container
docker restart r-practices

# Verify health
curl http://localhost:3000/health
```

**2. Full Recovery (< 30 minutes)**
```bash
# Stop current service
docker-compose down

# Start new instance with same config
docker-compose up -d

# Verify all endpoints
curl http://localhost:3000/health
curl http://localhost:3000/openapi.json | head -20
```

**3. Complete Rebuild (If data corruption suspected)**
```bash
# Remove old data
docker-compose down -v

# Deploy fresh instance
docker-compose up -d

# Restore from backup (if available)
# Custom restore logic here
```

---

## Production Checklist

Before going live:

- [ ] Monitoring stack configured (Prometheus, Grafana, etc.)
- [ ] Alerting rules in place
- [ ] Logging aggregation configured
- [ ] Backup procedures documented and tested
- [ ] Disaster recovery plan tested
- [ ] Rate limiting configured appropriately
- [ ] HTTPS/TLS certificates valid
- [ ] Health checks passing
- [ ] Performance baselines established
- [ ] Security audit completed
- [ ] Staff trained on runbooks
- [ ] On-call rotation established
- [ ] Incident response plan documented

---

## References

- [SECURITY.md](./SECURITY.md) — Security configuration
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) — Deployment procedures
- [Prometheus Documentation](https://prometheus.io/docs/prometheus/latest/getting_started/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Docker Logging Documentation](https://docs.docker.com/config/containers/logging/)

---

**Last Updated:** 2026-09-27  
**Status:** Production Ready  
**Version:** 0.3.0
