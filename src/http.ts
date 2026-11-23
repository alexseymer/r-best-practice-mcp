#!/usr/bin/env node
/** Entry point of the hosted server: `node dist/http.js`. Settings come from environment variables (see http-config.ts). */
import { createHttpServer } from './http-server.js';
import { readHttpConfig } from './http-config.js';
import { createWebRoutes } from './web/routes.js';
import { getRuntimeConfig } from './config/runtime.js';
import { logger } from './utils/logger.js';

const config = readHttpConfig();
const version = getRuntimeConfig().version;
const maxBodyBytes = 2_000_000;
const server = createHttpServer({
  version,
  build: config.build,
  rateLimitPerMinute: config.rateLimitPerMinute,
  trustProxyHops: config.trustProxyHops,
  allowedOrigins: config.allowedOrigins,
  maxBodyBytes,
  routes: [
    createWebRoutes({
      version,
      build: config.build,
      rateLimitPerMinute: config.rateLimitPerMinute,
      maxBodyBytes,
      localPackage: config.localPackage,
    }),
  ],
});

server.listen(config.port, config.host, () => {
  logger.info(`R Best Practices MCP Server (HTTP) listening on ${config.host}:${config.port}`);
});

function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  // Do not wait forever for open connections.
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
