# API Versioning Strategy

## Overview

This document explains the API versioning strategy for the R Best Practices MCP Server, including how versions are managed, how to migrate between versions, and the lifecycle of deprecated endpoints.

---

## Versioning Model

The server uses **URL-based versioning** with two supported versions:

- **v0** — Legacy/stable API (backward compatible, minimal changes)
- **v1** — Current/stable API (with new features like pagination and improved documentation)

### Base URLs

```
v0: GET  /api/detect-workflow
v1: POST /api/v1/detect-workflow

v0: GET  /api/practices
v1: GET  /api/v1/practices (with pagination support)

v0: GET  /api/practice/:id
v1: GET  /api/v1/practice/:id
```

### Why URL Versioning?

- **Explicit**: Version is clear in the URL path
- **Parallel support**: Both v0 and v1 available simultaneously
- **Cache-friendly**: Caching layers can distinguish versions by URL
- **Load balancing**: Easy to route versions to different backends if needed
- **Monitoring**: Version-specific metrics easier to track

---

## Version Lifecycle

### Phase 1: Development (v1 introduced)
- New endpoints added under `/api/v1/`
- v0 endpoints still available and unchanged
- Both versions fully functional and tested
- Documentation updated for new features

### Phase 2: Stable (Current Status - v1 Production Ready)
- v1 endpoints are the recommended version
- v0 endpoints continue working
- Security updates applied to both
- Performance optimizations in v1

### Phase 3: Maintenance (v0 deprecated - future)
- v0 marked as deprecated (HTTP `Deprecation` header)
- Clients get 6 months notice before removal
- Migration guide provided
- v1 becomes exclusive

### Phase 4: Sunset (v0 removed - future)
- v0 endpoints return 410 Gone
- v1 only available
- Clients must have migrated

---

## Current Version Details

### v0 (Backward Compatible)

**Status**: Stable, maintained for backward compatibility

**Endpoints:**
```
POST /api/detect-workflow
POST /api/validate-project
POST /api/validate-file
POST /api/generate-template
GET  /api/practices          (no pagination)
GET  /api/practice/:id
```

**Characteristics:**
- No pagination (returns all results)
- No custom response headers
- Limited filtering options
- Original response format
- Still supports all core functionality

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/practices" \
  -H "Content-Type: application/json"
```

**Example Response:**
```json
{
  "error": false,
  "data": [
    { "id": "practice-1", "title": "...", ... },
    { "id": "practice-2", "title": "...", ... },
    ...
  ],
  "timestamp": 1695830400000
}
```

### v1 (Current Recommended)

**Status**: Current, recommended for all new development

**Endpoints:**
```
POST /api/v1/detect-workflow
POST /api/v1/validate-project
POST /api/v1/validate-file
POST /api/v1/generate-template
GET  /api/v1/practices          (with pagination)
GET  /api/v1/practice/:id
```

**New Features:**
- Pagination support (limit, offset)
- Rate limit headers
- Enhanced OpenAPI documentation
- Input validation headers
- Consistent error responses

**Pagination Parameters:**
```
GET /api/v1/practices?limit=25&offset=0

Query Parameters:
  limit  - Max results (1-100, default 50)
  offset - Skip N results (default 0)
  workflow - Filter by workflow type
  category - Filter by category
```

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/practices?limit=25&offset=0" \
  -H "Content-Type: application/json"
```

**Example Response:**
```json
{
  "error": false,
  "data": [
    { "id": "practice-1", "title": "...", ... },
    { "id": "practice-2", "title": "...", ... },
    ...
  ],
  "pagination": {
    "total": 52,
    "limit": 25,
    "offset": 0,
    "hasMore": true
  },
  "timestamp": 1695830400000
}
```

**Response Headers:**
```
X-Total-Count: 52
X-Pagination-Limit: 25
X-Pagination-Offset: 0
X-Pagination-Has-More: true
```

---

## Comparison: v0 vs v1

| Feature | v0 | v1 |
|---------|----|----|
| Backward compatible | Yes | Yes (new clients) |
| Pagination | No | Yes |
| Rate limit headers | Basic | Full |
| OpenAPI docs | Limited | Complete |
| Input validation | Basic | Enhanced |
| Error responses | Minimal | Structured |
| Custom headers | No | Yes |
| Workflow filtering | Basic | Advanced |
| Recommend for new code | No | **Yes** |
| Long-term support | Limited | **Long-term** |

---

## Migration Guide: v0 to v1

### Step 1: Check Current Version Usage

Identify which endpoints your client is using:

```bash
# Check logs for v0 usage
grep -r "POST /api/detect-workflow" logs/

# Check client code
grep -r "/api/detect-workflow" src/
```

### Step 2: Update Endpoint URLs

**Before (v0):**
```javascript
const response = await fetch('http://localhost:3000/api/detect-workflow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: '/home/user/my-project' })
});
```

**After (v1):**
```javascript
const response = await fetch('http://localhost:3000/api/v1/detect-workflow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: '/home/user/my-project' })
});
```

### Step 3: Handle Pagination (if using /practices)

**Before (v0 - returns all practices):**
```javascript
const response = await fetch('http://localhost:3000/api/practices');
const data = await response.json();
const allPractices = data.data; // Array of all practices
```

**After (v1 - paginated):**
```javascript
const limit = 50;
let offset = 0;
let allPractices = [];
let hasMore = true;

while (hasMore) {
  const response = await fetch(
    `http://localhost:3000/api/v1/practices?limit=${limit}&offset=${offset}`
  );
  const data = await response.json();
  
  allPractices = allPractices.concat(data.data);
  hasMore = data.pagination.hasMore;
  offset += limit;
}
```

**Or with filtering:**
```javascript
const response = await fetch(
  'http://localhost:3000/api/v1/practices?limit=50&offset=0&workflow=package&category=documentation'
);
const data = await response.json();
```

### Step 4: Parse Response Headers (Optional)

**v1 includes pagination headers:**
```javascript
const response = await fetch('http://localhost:3000/api/v1/practices?limit=25');
const total = response.headers.get('X-Total-Count');
const hasMore = response.headers.get('X-Pagination-Has-More') === 'true';

console.log(`Total practices: ${total}, More available: ${hasMore}`);
```

### Step 5: Testing

**Test basic endpoint:**
```bash
curl -X POST http://localhost:3000/api/v1/detect-workflow \
  -H "Content-Type: application/json" \
  -d '{"path": "/home/user/my-project"}'
```

**Test pagination:**
```bash
curl -X GET "http://localhost:3000/api/v1/practices?limit=10&offset=0"
```

**Test filtering:**
```bash
curl -X GET "http://localhost:3000/api/v1/practices?workflow=package&limit=10"
```

### Step 6: Update Documentation

- Update README with v1 endpoints
- Update API client documentation
- Update architecture diagrams
- Update integration guides

---

## Backward Compatibility Guarantee

### v0 Endpoints

The following v0 endpoints will continue working unchanged:

```
POST /api/detect-workflow
POST /api/validate-project
POST /api/validate-file
POST /api/generate-template
GET  /api/practices         (no pagination)
GET  /api/practice/:id
```

**Guarantee Period:** Until Phase 3 (6+ months notice before removal)

### What Will NOT Change in v0

- Request format/parameters
- Response format/structure
- Response codes
- Error messages

### What CAN Change in v0

- Performance optimizations (faster, not breaking)
- Security improvements (harder to exploit, not breaking)
- Bug fixes (correcting wrong behavior)

---

## Deprecation Policy

### How We Signal Deprecation

**1. HTTP Deprecation Header** (when applicable)
```
Deprecation: true
Sunset: Sun, 27 Sep 2027 00:00:00 GMT
```

**2. Documentation Updates**
- Version marked as deprecated in API docs
- Migration guide provided
- Recommended version clearly stated

**3. Warning Messages**
- Server logs warn when deprecated endpoints are used
- Future versions may include warnings in responses

### Timeline

- **Month 1-6**: Maintain v0, actively develop v1
- **Month 7**: Mark v0 as deprecated with 6-month notice
- **Month 13**: Remove v0 endpoints (return 410 Gone)

---

## API Documentation

### OpenAPI Specification

Both versions are documented in the OpenAPI 3.0 specification:

```bash
# Get full spec
curl http://localhost:3000/openapi.json

# View in Swagger UI
open http://localhost:3000/api-docs
```

### Version in OpenAPI

Each endpoint is clearly documented with its version:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "R Best Practices MCP Server",
    "version": "0.3.0",
    "description": "..."
  },
  "paths": {
    "/api/v1/practices": {
      "get": {
        "summary": "List Best Practices",
        "description": "List best practices, optionally filtered by workflow or category",
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "schema": { "type": "integer", "minimum": 1, "maximum": 100 }
          },
          {
            "name": "offset",
            "in": "query",
            "schema": { "type": "integer", "minimum": 0 }
          }
        ]
      }
    }
  }
}
```

---

## Version-Specific Considerations

### Rate Limiting

Both v0 and v1 share the same rate limit bucket:
- 100 requests per 60 seconds per IP address
- Affects both `/api/` and `/api/v1/` endpoints
- Rate limit headers available on v1 responses

### Caching

**v0 (cache-safe):**
```bash
GET /api/practices                # Cache key: practices_v0
GET /api/practice/practice-1      # Cache key: practice_practice-1_v0
```

**v1 (cache-aware):**
```bash
GET /api/v1/practices?limit=50&offset=0    # Cache key: practices_v1_limit50_offset0
GET /api/v1/practice/practice-1            # Cache key: practice_practice-1_v1
```

Reverse proxies can cache based on URL, automatically segregating versions.

### Monitoring

Track usage by version to plan migration:

```bash
# Monitor v0 usage
curl http://localhost:3000/metrics | grep api_requests_total | grep -v v1

# Monitor v1 usage
curl http://localhost:3000/metrics | grep api_requests_total | grep v1
```

---

## Error Handling

### Common Error Responses

**v0 and v1 (same format):**

```json
{
  "error": true,
  "code": "INVALID_PATH",
  "message": "Path validation failed: Path traversal detected",
  "timestamp": 1695830400000
}
```

**HTTP Status Codes:**
- `200` — Success
- `400` — Bad request (validation error)
- `404` — Not found
- `429` — Rate limit exceeded
- `500` — Server error
- `503` — Service unavailable

### v1 Enhanced Errors

v1 responses may include additional context:

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": {
    "field": "limit",
    "expected": "integer between 1 and 100",
    "received": "150"
  },
  "timestamp": 1695830400000
}
```

---

## Future Versions

### v2 (Planned - Not Yet Released)

Future considerations for v2:

- **GraphQL support** (alongside REST)
- **Streaming responses** for large datasets
- **Webhook support** for async validation
- **Custom authentication** support
- **Batch operations** endpoint
- **Advanced filtering** with complex queries

No timeline for v2 yet. Current focus on v1 stability.

---

## Frequently Asked Questions

### Q: Should I use v0 or v1?

**A:** Use v1 for all new development. v0 is for backward compatibility only.

### Q: Will v0 be removed?

**A:** Yes, but not until 6+ months after deprecation notice. You have time to migrate.

### Q: Can I mix v0 and v1 in the same client?

**A:** Yes, but it's not recommended. Migrate all endpoints to v1 for consistency.

### Q: Do v0 and v1 share rate limits?

**A:** Yes, they use the same rate limit bucket (100 req/60s per IP).

### Q: Which version should my CI/CD use?

**A:** Use v1. It provides better features for automation (pagination, filtering).

### Q: How do I know which version a response is from?

**A:** Check the URL path (`/api/` vs `/api/v1/`). v1 responses include pagination headers.

### Q: What if I'm using v0 and it stops working?

**A:** Migrate to v1 immediately. If you need help, contact alexseymer@gmail.com.

---

## Support & References

- **API Documentation**: `/openapi.json` or `/api-docs`
- **Deployment Checklist**: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **Security Guide**: [SECURITY.md](./SECURITY.md)
- **Architecture**: [CLAUDE.md](./CLAUDE.md)

---

**Last Updated:** 2026-09-27  
**Current Version:** 0.3.0  
**Status:** v1 Production Ready, v0 Backward Compatible
