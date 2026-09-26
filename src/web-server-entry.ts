import { RPracticesWebServer } from './web-server.js';
import { logger } from './utils/logger.js';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const server = new RPracticesWebServer(port);

server.start().catch((error) => {
  logger.error('Failed to start web server', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
