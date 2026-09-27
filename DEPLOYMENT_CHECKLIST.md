# Deployment Checklist

## Production Deployment Guide for R Best Practices MCP Server

This checklist ensures your deployment meets security, performance, and reliability standards.

---

## Pre-Deployment Verification

### Security Configuration
- [ ] Review [SECURITY.md](./SECURITY.md) completely
- [ ] All environment variables configured (no secrets in code)
- [ ] API keys/tokens stored in environment, not source control
- [ ] Rate limits configured for expected traffic (default: 100 req/60s)
- [ ] Request size limits set appropriately (default: 50MB)
- [ ] Path validation enabled (prevents directory traversal)
- [ ] Input sanitization active on all endpoints
- [ ] HTTPS/TLS configured with valid certificates
- [ ] CORS policy defined if needed

### Infrastructure Readiness
- [ ] Docker image built and tested locally
- [ ] Docker image tagged with version number (not using `:latest`)
- [ ] Container registry configured (Docker Hub, ECR, etc.)
- [ ] Reverse proxy (Nginx/CloudFlare) configured
- [ ] SSL/TLS certificates obtained and valid
- [ ] Database/logging backend provisioned (if used)
- [ ] Monitoring and alerting configured
- [ ] Backup procedures documented

### Code Quality
- [ ] All tests passing: `npm test`
- [ ] TypeScript compilation clean: `npm run build`
- [ ] No console.log statements in production code
- [ ] Error handling comprehensive and logged
- [ ] Dependencies up to date: `npm audit`
- [ ] Code reviewed for security issues
- [ ] Sensitive data scrubbed from logs

### Documentation
- [ ] API documentation available (`/openapi.json`, `/api-docs`)
- [ ] README.md updated with deployment info
- [ ] API_VERSIONING.md reviewed
- [ ] SECURITY.md reviewed by operations team
- [ ] Runbook for common issues documented
- [ ] Incident response procedures documented

---

## Docker Build & Registry

### Build Image
```bash
# Build with version tag
docker build -t alexseymer/r-best-practices-mcp:0.3.0 .

# Tag as latest
docker tag alexseymer/r-best-practices-mcp:0.3.0 \
  alexseymer/r-best-practices-mcp:latest

# Verify image
docker run --rm alexseymer/r-best-practices-mcp:0.3.0 --version
```

### Push to Registry
```bash
# Login to Docker Hub (or your registry)
docker login

# Push versioned tag (required for production)
docker push alexseymer/r-best-practices-mcp:0.3.0

# Push latest tag
docker push alexseymer/r-best-practices-mcp:latest
```

### Image Security
- [ ] Scan for vulnerabilities: `docker scan alexseymer/r-best-practices-mcp:0.3.0`
- [ ] No secrets in image (check with `docker history`)
- [ ] Non-root user runs container
- [ ] Base image updated to latest patch

---

## Network Configuration

### Reverse Proxy (Nginx)

**SSL/TLS Setup:**
```bash
# Obtain certificate (Let's Encrypt example)
certbot certonly --standalone -d r-best-practice-mcp.example.com

# Copy certificates
sudo cp /etc/letsencrypt/live/r-best-practice-mcp.example.com/fullchain.pem \
  /etc/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/r-best-practice-mcp.example.com/privkey.pem \
  /etc/nginx/ssl/key.pem
```

**Nginx Configuration:**
```nginx
upstream app {
  server app:3000;
}

server {
  listen 443 ssl http2;
  server_name r-best-practice-mcp.example.com;

  ssl_certificate /etc/nginx/ssl/cert.pem;
  ssl_certificate_key /etc/nginx/ssl/key.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;

  # Security headers
  add_header Strict-Transport-Security "max-age=31536000" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-XSS-Protection "1; mode=block" always;

  # Rate limiting at reverse proxy
  limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
  limit_req zone=api burst=100 nodelay;

  # Proxy settings
  proxy_pass http://app;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_buffering off;
  proxy_request_buffering off;
}

server {
  listen 80;
  server_name r-best-practice-mcp.example.com;
  return 301 https://$server_name$request_uri;
}
```

### Firewall Rules
- [ ] SSH limited to known IPs
- [ ] Inbound HTTP/HTTPS from all IPs
- [ ] Inbound to application port 3000 limited to reverse proxy only
- [ ] Outbound restricted as needed
- [ ] Database port accessible only from application

---

## Container Deployment

### Docker Compose (Single Server)

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    image: alexseymer/r-best-practices-mcp:0.3.0
    restart: always
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
    ports:
      - "3000:3000"
    volumes:
      - /projects:/projects:ro  # Read-only access to projects
    resources:
      limits:
        cpus: '2'
        memory: 512M
      reservations:
        cpus: '1'
        memory: 256M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - app

  # Optional: Monitoring
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    restart: always

volumes:
  prometheus_data:
```

**Deploy:**
```bash
# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f app

# Graceful stop
docker-compose down
```

### Kubernetes Deployment

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: r-best-practices-mcp
  labels:
    app: r-best-practices-mcp
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: r-best-practices-mcp
  template:
    metadata:
      labels:
        app: r-best-practices-mcp
    spec:
      containers:
      - name: app
        image: alexseymer/r-best-practices-mcp:0.3.0
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: production
        - name: LOG_LEVEL
          value: info
        resources:
          requests:
            cpu: "500m"
            memory: "256Mi"
          limits:
            cpu: "1000m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        volumeMounts:
        - name: projects
          mountPath: /projects
          readOnly: true
      volumes:
      - name: projects
        hostPath:
          path: /var/r-projects
          type: Directory

---
apiVersion: v1
kind: Service
metadata:
  name: r-best-practices-mcp
spec:
  selector:
    app: r-best-practices-mcp
  ports:
  - port: 80
    targetPort: http
  type: LoadBalancer

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: r-best-practices-mcp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: r-best-practices-mcp
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Deploy to K8s:**
```bash
# Apply configuration
kubectl apply -f deployment.yaml

# Monitor rollout
kubectl rollout status deployment/r-best-practices-mcp

# View pods
kubectl get pods -l app=r-best-practices-mcp

# View logs
kubectl logs -l app=r-best-practices-mcp -f

# Check service
kubectl get svc r-best-practices-mcp
```

---

## Monitoring & Logging

### Built-in Endpoints

**Health Check:**
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "R Best Practices MCP Server",
  "version": "0.3.0",
  "timestamp": "2026-09-27T10:30:00.000Z",
  "metrics": { ... }
}
```

**Metrics:**
```bash
curl http://localhost:3000/metrics
```

**Rate Limit Stats:**
```bash
curl http://localhost:3000/metrics/rate-limit
```

### Logging Configuration

**Docker Logging:**
```bash
# View logs
docker logs -f container_id

# Send to CloudWatch (AWS)
docker run -d \
  --log-driver=awslogs \
  --log-opt awslogs-group=/ecs/r-best-practices-mcp \
  --log-opt awslogs-region=us-east-1 \
  alexseymer/r-best-practices-mcp:0.3.0

# Send to Splunk
docker run -d \
  --log-driver=splunk \
  --log-opt splunk-token=<HEC_TOKEN> \
  --log-opt splunk-url=https://splunk.example.com:8088 \
  alexseymer/r-best-practices-mcp:0.3.0
```

### Monitoring Stack

**Prometheus:**
- Scrape `/metrics` endpoint every 15s
- Set up alerts for:
  - HTTP 5xx errors > 1% of requests
  - Response time p95 > 1000ms
  - Rate limit threshold exceeded
  - Health check failing

**Grafana Dashboard:**
- Request rate (requests/sec)
- Response time (p50, p95, p99)
- Error rate (by status code)
- Rate limit usage (% of limit)
- Active connections

**Example Alert:**
```yaml
groups:
  - name: app_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}"
```

---

## Security Validation

### Pre-Deployment Testing

**HTTPS/TLS:**
```bash
# Check certificate validity
openssl s_client -connect r-best-practice-mcp.example.com:443

# Verify TLS version
curl -I --tlsv1.2 https://r-best-practice-mcp.example.com
```

**Security Headers:**
```bash
curl -I https://r-best-practice-mcp.example.com | grep -i "strict-transport\|x-content-type\|x-frame-options"
```

**Rate Limiting:**
```bash
# Test rate limit (should get 429 after 100 requests)
for i in {1..105}; do
  curl -s http://localhost:3000/health | jq '.status'
done
```

**Path Traversal Protection:**
```bash
# This should return 400 Bad Request
curl -X POST http://localhost:3000/api/v1/detect-workflow \
  -H "Content-Type: application/json" \
  -d '{"path": "../../etc/passwd"}'
```

**Request Size Limits:**
```bash
# Create 60MB file
dd if=/dev/zero of=/tmp/large.json bs=1M count=60

# This should return 413 Payload Too Large
curl -X POST http://localhost:3000/api/v1/validate-project \
  -H "Content-Type: application/json" \
  -d @/tmp/large.json
```

### Vulnerability Scanning

```bash
# Scan dependencies
npm audit

# Scan Docker image
docker scan alexseymer/r-best-practices-mcp:0.3.0

# Run SAST (if configured)
npm run lint:security  # or similar
```

---

## Performance Validation

### Load Testing

**Using Apache Bench:**
```bash
# 1000 requests, 10 concurrent
ab -n 1000 -c 10 http://localhost:3000/health

# Measure API endpoint
ab -n 1000 -c 10 -p payload.json -T application/json \
  http://localhost:3000/api/v1/practices
```

**Using k6:**
```bash
npm install -g k6

# Create load-test.js
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  let res = http.get('http://localhost:3000/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
EOF

# Run load test
k6 run load-test.js
```

---

## Post-Deployment Verification

### Immediate After Deploy
- [ ] Health check passing: `curl http://localhost:3000/health`
- [ ] API endpoints responding: `curl http://localhost:3000/api/v1/practices`
- [ ] OpenAPI spec available: `curl http://localhost:3000/openapi.json`
- [ ] Swagger UI accessible: Visit `/api-docs`
- [ ] No error messages in logs
- [ ] Resource usage normal (CPU < 50%, memory < 50%)

### First 24 Hours
- [ ] Monitoring dashboard shows stable metrics
- [ ] No unexpected errors in logs
- [ ] Rate limiting working (test with spike)
- [ ] Response times consistent
- [ ] Health checks passing 100% of time
- [ ] No security alerts

### First Week
- [ ] Performance baseline established
- [ ] Peak load handled successfully
- [ ] Error patterns understood and normal
- [ ] Backup/restore procedures tested
- [ ] Disaster recovery plan verified
- [ ] Team trained on runbook

---

## Rollback Procedure

### If Deployment Fails

**Docker Compose:**
```bash
# Stop current deployment
docker-compose down

# Restore previous version
docker-compose -f docker-compose.0.2.0.yml up -d

# Verify
docker-compose ps
```

**Kubernetes:**
```bash
# Check rollout status
kubectl rollout status deployment/r-best-practices-mcp

# Rollback if needed
kubectl rollout undo deployment/r-best-practices-mcp

# Verify rollback
kubectl rollout status deployment/r-best-practices-mcp
```

### Communication
- [ ] Notify stakeholders of rollback
- [ ] Document reason for rollback
- [ ] Create incident ticket
- [ ] Schedule post-mortem
- [ ] Plan for next deployment

---

## Maintenance Schedule

### Daily
- [ ] Monitor health checks (automated)
- [ ] Review error logs (automated alerts)
- [ ] Check resource usage (dashboard)

### Weekly
- [ ] Review performance metrics
- [ ] Check for security updates
- [ ] Verify backup integrity

### Monthly
- [ ] Update dependencies: `npm update`
- [ ] Run security scan: `npm audit`
- [ ] Review and rotate logs
- [ ] Performance optimization review

### Quarterly
- [ ] Full security audit
- [ ] Capacity planning review
- [ ] Disaster recovery drill
- [ ] Documentation update

---

## Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check logs
docker logs container_id

# Verify environment variables
docker inspect container_id | grep -A 10 Env

# Test locally
docker run -it alexseymer/r-best-practices-mcp:0.3.0 /bin/sh
```

**High error rate:**
```bash
# Check metrics
curl http://localhost:3000/metrics

# Review logs
docker logs -f container_id

# Check disk space
df -h

# Check rate limit stats
curl http://localhost:3000/metrics/rate-limit
```

**Slow response times:**
```bash
# Check CPU/memory
docker stats container_id

# Check node metrics endpoint
curl http://localhost:3000/health | jq '.metrics'

# Review slow query logs (if applicable)
```

See [SECURITY.md](./SECURITY.md) for security-specific troubleshooting.

---

## Support & Documentation

- **API Documentation**: `/openapi.json` or `/api-docs`
- **Security Guide**: [SECURITY.md](./SECURITY.md)
- **Versioning Strategy**: [API_VERSIONING.md](./API_VERSIONING.md)
- **Architecture**: [CLAUDE.md](./CLAUDE.md)
- **Issues**: Report to alexseymer@gmail.com

---

**Last Updated:** 2026-09-27  
**Version:** 0.3.0  
**Status:** Production Ready
