#!/usr/bin/env node

import { runCLI } from '../cli/index.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
R Best Practices CLI Tool v1.0.0
═════════════════════════════════

Usage: r-practices <command> [options]

Commands:
  detect <path>      Detect the R workflow type
  validate <path>    Validate project against best practices
  template <type>    Generate a project template
  report <path>      Generate an HTML validation report

Options:
  -h, --help         Show this help message
  -v, --version      Show version number

Examples:
  r-practices detect .
  r-practices validate . --workflow package
  r-practices template shiny --name my-app
  r-practices report . --output report.html

For more help: r-practices <command> --help
  `);
  process.exit(0);
}

runCLI(['node', 'cli.ts', ...args]).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
