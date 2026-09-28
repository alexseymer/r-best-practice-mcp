# R Best Practices MCP Server - Deployment Guide

## Overview

This guide covers deployment of the R Best Practices MCP Server to various environments. The server can be deployed as:

1. **npm Package** — Install locally or in Node.js projects
2. **Docker Container** — Containerized deployment for any environment
3. **Standalone Binary** — Self-contained executable
4. **Cloud Services** — AWS, Azure, Google Cloud deployments

## Installation

### NPM Package Installation

**Install from npm registry:**

```bash
npm install -g r-best-practices-mcp
```

**Or as a project dependency:**

```bash
npm install --save-dev r-best-practices-mcp
```

**Verify installation:**

```bash
r-practices --version
```

### From Source

**Clone and build:**

```bash
git clone https://github.com/alexseymer/r-coding-mcp.git
cd r-coding-mcp
npm install
npm run build
npm install -g .
```

## Docker Deployment

### Build Docker Image

**Build locally:**

```bash
npm run docker:build
```

**Or manually:**

```bash
docker build -t r-best-practices-mcp:latest .
```

**Build specific version:**

```bash
docker build -t r-best-practices-mcp:1.0.0 .
```

### Run Docker Container

**MCP Server mode (stdio):**

```bash
docker run -i r-best-practices-mcp:latest
```

**Web server mode (port 3000):**

```bash
docker run -p 3000:3000 r-best-practices-mcp:latest
```

**With volume mount for analysis:**

```bash
docker run -v /home/user/myproject:/app/project \
  -p 3000:3000 \
  r-best-practices-mcp:latest
```

**Development mode with hot reload:**

```bash
docker run -v /home/user/myproject:/app/project \
  -e NODE_ENV=development \
  -p 3000:3000 \
  r-best-practices-mcp:latest npm run watch
```

### Docker Compose

**docker-compose.yml example:**

```yaml
version: '3.8'

services:
  r-practices:
    build: .
    container_name: r-practices-server
    ports:
      - "3000:3000"
    volumes:
      - ./projects:/app/projects
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('OK')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Start with Docker Compose:**

```bash
docker-compose up -d
```

### Docker Hub

**Push to Docker Hub:**

```bash
docker tag r-best-practices-mcp:latest username/r-best-practices-mcp:latest
docker push username/r-best-practices-mcp:latest
```

**Pull from Docker Hub:**

```bash
docker pull username/r-best-practices-mcp:latest
```

## Cloud Deployments

### AWS Elastic Container Service (ECS)

**Task definition (task-definition.json):**

```json
{
  "family": "r-best-practices-mcp",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "r-practices",
      "image": "username/r-best-practices-mcp:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/r-practices",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "node -e 'console.log(1)' || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

**Deploy to ECS:**

```bash
# Create task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster my-cluster \
  --service-name r-practices \
  --task-definition r-best-practices-mcp \
  --desired-count 2 \
  --launch-type FARGATE
```

### Google Cloud Run

**Deploy to Cloud Run:**

```bash
gcloud run deploy r-practices \
  --source . \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --allow-unauthenticated
```

**With environment variables:**

```bash
gcloud run deploy r-practices \
  --source . \
  --platform managed \
  --region us-central1 \
  --set-env-vars LOG_LEVEL=info,NODE_ENV=production
```

### Azure Container Instances

**Deploy with Azure CLI:**

```bash
az container create \
  --resource-group myResourceGroup \
  --name r-practices-container \
  --image username/r-best-practices-mcp:latest \
  --ports 3000 \
  --environment-variables LOG_LEVEL=info \
  --memory 0.5 \
  --cpu 0.5
```

### Kubernetes

**Kubernetes deployment (deployment.yaml):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: r-practices
spec:
  replicas: 3
  selector:
    matchLabels:
      app: r-practices
  template:
    metadata:
      labels:
        app: r-practices
    spec:
      containers:
      - name: r-practices
        image: username/r-best-practices-mcp:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
---
apiVersion: v1
kind: Service
metadata:
  name: r-practices-service
spec:
  selector:
    app: r-practices
  type: LoadBalancer
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
```

**Deploy to Kubernetes:**

```bash
kubectl apply -f deployment.yaml
kubectl get svc r-practices-service
```

## CLI Usage

### Basic Commands

**Analyze a project:**

```bash
r-practices analyze /path/to/project
```

**Validate a single file:**

```bash
r-practices validate /path/to/file.R
```

**Generate template:**

```bash
r-practices template generate --workflow package --name mypackage
```

**List practices:**

```bash
r-practices practices list --workflow package
```

### Advanced Usage

**With custom rules:**

```bash
r-practices analyze /path/to/project --rules custom-rules.json
```

**Strict mode (fail on warnings):**

```bash
r-practices analyze /path/to/project --strict
```

**Output as JSON:**

```bash
r-practices analyze /path/to/project --json > results.json
```

**Watch mode (continuous):**

```bash
r-practices analyze /path/to/project --watch
```

## Web API

### Starting Web Server

**Development:**

```bash
npm run start:web
```

**Production:**

```bash
NODE_ENV=production node dist/web-server-entry.js
```

### API Endpoints

**Analyze project:**

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/project"}'
```

**Validate file:**

```bash
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/file.R"}'
```

**Get practice info:**

```bash
curl http://localhost:3000/api/practices/naming-snake_case
```

## CI/CD Integration

### GitHub Actions

**.github/workflows/r-practices.yml:**

```yaml
name: R Best Practices

on:
  push:
    paths:
      - '**.R'
      - '**.Rmd'
      - '**.qmd'
  pull_request:

jobs:
  analyze:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - uses: actions/setup-node@v3
      with:
        node-version: '20'
    
    - name: Install r-best-practices
      run: npm install -g r-best-practices-mcp
    
    - name: Analyze project
      run: r-practices analyze . --json > results.json
      continue-on-error: true
    
    - name: Comment results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const results = JSON.parse(fs.readFileSync('results.json', 'utf8'));
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `## R Best Practices Analysis\n\n${JSON.stringify(results, null, 2)}`
          });
```

### GitLab CI

**.gitlab-ci.yml:**

```yaml
analyze:
  image: node:20-alpine
  script:
    - npm install -g r-best-practices-mcp
    - r-practices analyze . --json
  artifacts:
    reports:
      codequality: results.json
```

### Jenkins

**Jenkinsfile:**

```groovy
pipeline {
  agent any
  
  stages {
    stage('Analyze') {
      steps {
        sh 'npm install -g r-best-practices-mcp'
        sh 'r-practices analyze . --json > results.json'
      }
    }
    stage('Report') {
      steps {
        publishJSON(
          jsonTestReportLocation: 'results.json',
          log: true
        )
      }
    }
  }
}
```

## Monitoring & Logging

### Log Configuration

**Enable debug logging:**

```bash
DEBUG=r-practices:* npm start
```

**Log levels:**

```
error   - Critical errors
warn    - Warnings
info    - General information (default)
debug   - Detailed debugging
```

### Health Checks

**For containerized deployments:**

```bash
curl http://localhost:3000/health
```

**Response:**

```json
{
  "status": "ok",
  "uptime": 1234567,
  "memory": {
    "heapUsed": 12345678,
    "heapTotal": 34567890
  }
}
```

## Performance Tuning

### Node.js Flags

**Increase heap size:**

```bash
NODE_OPTIONS="--max-old-space-size=4096" r-practices analyze ./large-project
```

**Enable clustering:**

```bash
NODE_OPTIONS="--experimental-worker" npm start
```

### Cache Management

**Clear cache on startup:**

```bash
r-practices cache clear
r-practices analyze .
```

**Set cache TTL:**

```bash
CACHE_TTL=300000 npm start # 5 minute cache
```

## Security Considerations

### HTTPS Setup

**With reverse proxy (nginx):**

```nginx
upstream r-practices {
  server localhost:3000;
}

server {
  listen 443 ssl;
  server_name r-practices.example.com;
  
  ssl_certificate /etc/ssl/certs/cert.pem;
  ssl_certificate_key /etc/ssl/private/key.pem;
  
  location / {
    proxy_pass http://r-practices;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### Authentication

**Environment-based authentication:**

```bash
export AUTH_TOKEN="your-secret-token"
npm start
```

**Client usage:**

```bash
curl -H "Authorization: Bearer your-secret-token" \
  http://localhost:3000/api/analyze
```

## Troubleshooting

### Common Issues

**Issue: Out of memory**
- Solution: Increase Node.js heap size
- `NODE_OPTIONS="--max-old-space-size=4096"`

**Issue: Slow analysis on large projects**
- Solution: Enable caching
- Use `--cache` flag or set CACHE_TTL env var

**Issue: Docker build fails**
- Solution: Clear Docker cache
- `docker system prune`

**Issue: Port already in use**
- Solution: Change port or kill process
- `PORT=3001 npm start`

## Next Steps

- [CLI Usage Guide](./CLI.md)
- [API Documentation](./API.md)
- [Performance Optimization](./PERFORMANCE_OPTIMIZATION.md)
- [Configuration Guide](./CONFIGURATION.md)

## Support

For issues and questions:
- GitHub Issues: https://github.com/alexseymer/r-coding-mcp/issues
- Documentation: https://github.com/alexseymer/r-coding-mcp#readme
- Email: alexseymer@gmail.com
