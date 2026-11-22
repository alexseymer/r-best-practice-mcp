/**
 * The tool surface of the MCP server: three tools, their names, descriptions and input schemas.
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CATEGORIES, SEVERITIES } from '../types/finding.js';
import { VALID_WORKFLOWS } from '../utils/security.js';

/** Project types that create_project can generate. */
export const PROJECT_TYPES = ['package', 'shiny', 'quarto', 'rmarkdown', 'analysis'] as const;

export const TOOLS: Tool[] = [
  {
    name: 'check_project',
    description:
      'Check an R project folder against best practices. Detects the project type (unless `workflow` is given), ' +
      'then returns the findings with severity, message and suggestions. Use `minSeverity` to show only serious findings.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the project folder' },
        workflow: {
          type: 'string',
          enum: [...VALID_WORKFLOWS],
          description: 'Project type to check against. Omit to detect it automatically.',
        },
        minSeverity: {
          type: 'string',
          enum: [...SEVERITIES],
          description: 'Only return findings at least this severe',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          enum: [...CATEGORIES],
          description: 'Only return findings in these categories',
        },
        maxFindings: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
          description: 'Return at most this many findings (the summary still counts all)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_practice',
    description:
      'Explain one best practice: why it matters, what is checked, good and bad examples, and references.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Practice id, for example "pkg-readme"' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_project',
    description:
      'Create the file list for a standard R project. Returns the files and folders; the client writes them ' +
      'into the target folder. If projectName is missing, the response lists the questions to ask the user ' +
      'first. Use the matching prompt (for example new-r-package) to guide the user through the questions.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [...PROJECT_TYPES],
          description: 'Kind of project to create',
        },
        projectName: {
          type: 'string',
          description:
            'Project or package name. Packages: letters, digits and dots, starting with a letter. Others: letters, digits, dots, dashes and underscores.',
        },
        authorName: { type: 'string', description: 'Author name for DESCRIPTION, README and headers' },
        authorEmail: { type: 'string', description: 'Author e-mail address' },
      },
      required: ['type'],
    },
  },
];
