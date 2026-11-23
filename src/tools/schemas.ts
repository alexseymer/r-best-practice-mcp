/**
 * The tool surface of the MCP server: names, descriptions and input schemas.
 *
 * Two modes share get_practice and create_project:
 *  - local (stdio, on the user's machine): check_project reads a project folder by path.
 *  - remote (hosted over HTTP): check_files validates files sent as text. The hosted server never reads
 *    its own disk for a client, so check_project is not offered there.
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CATEGORIES, SEVERITIES } from '../types/finding.js';
import { VALID_WORKFLOWS } from '../utils/security.js';
import { FILE_LIMITS } from '../check-files.js';

/** Project types that create_project can generate. */
export const PROJECT_TYPES = ['package', 'shiny', 'quarto', 'rmarkdown', 'analysis'] as const;

export type ServerMode = 'local' | 'remote';

const FINDING_FILTERS = {
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
} as const;

const CHECK_PROJECT: Tool = {
  name: 'check_project',
  description:
    'Check an R project folder against best practices. Detects the project type (unless `workflow` is given), ' +
    'then returns the findings with severity, message and suggestions. Use `minSeverity` to show only serious findings.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to the project folder' },
      ...FINDING_FILTERS,
    },
    required: ['path'],
  },
};

const CHECK_FILES: Tool = {
  name: 'check_files',
  description:
    'Check an R project against best practices from files you send as text. Use this when the server cannot see ' +
    'your disk. Detects the project type (unless `workflow` is given) and returns the findings. Paths are relative ' +
    `to the project folder. At most ${FILE_LIMITS.maxFiles} files, ${FILE_LIMITS.maxFileBytes} bytes per file and ` +
    `${FILE_LIMITS.maxTotalBytes} bytes in total. Send the files that matter ` +
    '(DESCRIPTION, NAMESPACE, README, R/, tests/, renv.lock, app.R, _quarto.yml, ...), not data or build output. ' +
    'Without a .git entry the version-control check cannot tell whether the project is under version control.',
  inputSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        description: 'The project files',
        items: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path relative to the project folder, for example "R/hello.R"',
            },
            content: { type: 'string', description: 'UTF-8 text of the file' },
          },
          required: ['path', 'content'],
        },
      },
      ...FINDING_FILTERS,
    },
    required: ['files'],
  },
};

const GET_PRACTICE: Tool = {
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
};

const CREATE_PROJECT: Tool = {
  name: 'create_project',
  description:
    'Create the file list for a standard R project. Returns the files and folders; the client writes them ' +
    'into the target folder. If projectName is missing, the response lists the questions to ask the user ' +
    'first. Use the matching prompt (for example neues-r-paket) to guide the user through the questions.',
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
};

export function toolsFor(mode: ServerMode): Tool[] {
  return mode === 'remote'
    ? [CHECK_FILES, GET_PRACTICE, CREATE_PROJECT]
    : [CHECK_PROJECT, GET_PRACTICE, CREATE_PROJECT];
}
