# The image runs the MCP server over stdio. It has no port and no web interface.
# Use it with `docker run -i --rm <image>`; the MCP client writes requests to stdin.

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY src ./src
COPY tsconfig.json ./

RUN npm run build && test -s dist/index.js

# Runtime stage
FROM node:20-alpine

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

ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]

# Start the MCP server on stdin/stdout
CMD ["node", "dist/index.js"]
