#!/usr/bin/env node

import { RPracticesMCPServer } from './server.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  try {
    const server = new RPracticesMCPServer();
    await server.start();
  } catch (error) {
    logger.error('Fatal error', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Uncaught error:', error);
  process.exit(1);
});
