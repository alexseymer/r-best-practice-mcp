# One image, two ways to run it:
#   stdio (default):  docker run -i --rm <image>               the MCP client writes requests to stdin
#   hosted over HTTP: docker run -p 3000:3000 <image> node dist/http.js   (see compose.yaml and HOSTING.md)

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY src ./src
COPY tsconfig.json ./

RUN npm run build && test -s dist/index.js

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Build information shown on /health and on the page's System tab (optional)
ARG GIT_SHA=""
ARG BUILD_TIME=""
ENV NODE_ENV=production \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}

# Only used by the HTTP mode (node dist/http.js)
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

# Default: the MCP server on stdin/stdout. The hosted server overrides this with `node dist/http.js`.
CMD ["node", "dist/index.js"]
