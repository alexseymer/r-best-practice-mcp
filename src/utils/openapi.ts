import { CATEGORIES, SEVERITIES } from '../types/finding.js';
import { ENFORCEMENTS } from '../types/practice.js';
import {
  TOOL_DEFS,
  ToolDef,
  requestSchemaName,
  toOpenApiParameters,
  toOpenApiPath,
  toOpenApiRequestSchema,
} from '../tools/schemas.js';
import { buildUploadOpenApiPaths } from '../routes/upload.js';

/** Response documentation per operation (parameters and routes come from tools/schemas.ts). */
const TOOL_RESPONSES: Record<
  string,
  { ok: string; schema: string; errors: Record<number, string> }
> = {
  detectWorkflow: {
    ok: 'Workflow detected successfully',
    schema: 'DetectionResult',
    errors: { 400: 'Invalid input or missing parameters', 500: 'Server error during detection' },
  },
  validateProject: {
    ok: 'Project validation completed',
    schema: 'ValidationResult',
    errors: {
      400: 'Invalid input or parameters (code INVALID_PARAMETER for bad filter values)',
      404: 'Project directory not found',
      500: 'Server error during validation',
    },
  },
  validateFile: {
    ok: 'File validation completed',
    schema: 'FileValidationResult',
    errors: {
      400: 'Invalid input or parameters (code INVALID_PARAMETER for bad filter values)',
      404: 'File not found',
      500: 'Server error during validation',
    },
  },
  generateTemplate: {
    ok: 'Template generated successfully',
    schema: 'TemplateResult',
    errors: { 400: 'Invalid workflow type', 500: 'Server error during generation' },
  },
  listPractices: {
    ok: 'List of practices',
    schema: 'PracticesListResult',
    errors: {
      400: 'Invalid filter parameters (code INVALID_PARAMETER or INVALID_WORKFLOW)',
      500: 'Server error',
    },
  },
  getPractice: {
    ok: 'Practice details',
    schema: 'Practice',
    errors: { 404: 'Practice not found', 500: 'Server error' },
  },
};

function buildOperation(tool: ToolDef): Record<string, unknown> {
  const doc = TOOL_RESPONSES[tool.operationId];
  const responses: Record<number, unknown> = {
    200: {
      description: doc.ok,
      content: {
        'application/json': { schema: { $ref: `#/components/schemas/${doc.schema}` } },
      },
    },
  };
  for (const [code, description] of Object.entries(doc.errors)) {
    responses[Number(code)] = { description };
  }
  const operation: Record<string, unknown> = {
    summary: tool.summary,
    description: tool.description,
    operationId: tool.operationId,
    tags: [tool.tag],
  };
  if (tool.method === 'POST') {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${requestSchemaName(tool)}` },
        },
      },
    };
  } else {
    operation.parameters = toOpenApiParameters(tool);
  }
  operation.responses = responses;
  return operation;
}

function buildToolPaths(): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const tool of TOOL_DEFS) {
    paths[toOpenApiPath(tool)] = { [tool.method.toLowerCase()]: buildOperation(tool) };
  }
  return paths;
}

function buildRequestSchemas(): Record<string, unknown> {
  return Object.fromEntries(
    TOOL_DEFS.filter((t) => t.method === 'POST').map((t) => [
      requestSchemaName(t),
      toOpenApiRequestSchema(t),
    ])
  );
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact: {
      name: string;
      email: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    responses: Record<string, any>;
    parameters: Record<string, any>;
  };
}

export class OpenAPIGenerator {
  static generateSpec(
    version: string = '0.2.0',
    baseUrl: string = 'http://localhost:3000'
  ): OpenAPISpec {
    return {
      openapi: '3.0.0',
      info: {
        title: 'R Best Practices MCP Server',
        version,
        description:
          'API for workflow detection, project validation, template generation, and best practices knowledge base for R development. The documented /api/v1 routes are the supported API; the unversioned /api/* routes are backward-compatible aliases.',
        contact: {
          name: 'Alexander Seymer',
          email: 'alexseymer@gmail.com',
          url: 'https://github.com/alexseymer/r-best-practice-mcp',
        },
      },
      servers: [
        {
          url: baseUrl,
          description: 'API Server',
        },
      ],
      paths: {
        '/health': {
          get: {
            summary: 'Health Check',
            description: 'Check server health and get basic metrics',
            operationId: 'getHealth',
            tags: ['Health'],
            responses: {
              200: {
                description: 'Server is healthy',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/HealthResponse',
                    },
                  },
                },
              },
            },
          },
        },
        ...buildToolPaths(),
        ...buildUploadOpenApiPaths(),
        '/metrics': {
          get: {
            summary: 'Get Metrics',
            description: 'Get performance and operation metrics',
            operationId: 'getMetrics',
            tags: ['Metrics'],
            responses: {
              200: {
                description: 'Metrics snapshot',
              },
            },
          },
        },
        '/metrics/rate-limit': {
          get: {
            summary: 'Get Rate Limit Stats',
            description: 'Get current rate limiting statistics by client IP',
            operationId: 'getRateLimitStats',
            tags: ['Metrics'],
            responses: {
              200: {
                description: 'Rate limit statistics',
              },
            },
          },
        },
      },
      components: {
        schemas: {
          ...buildRequestSchemas(),
          DetectionResult: {
            type: 'object',
            properties: {
              error: {
                type: 'boolean',
                example: false,
              },
              data: {
                type: 'object',
                properties: {
                  workflow: {
                    type: 'string',
                    example: 'package',
                  },
                  confidence: {
                    type: 'number',
                    example: 95,
                  },
                  indicators: {
                    type: 'array',
                    example: ['DESCRIPTION', 'R/', 'tests/testthat/'],
                  },
                },
              },
              timestamp: {
                type: 'number',
              },
            },
          },
          ValidationResult: {
            type: 'object',
            properties: {
              error: {
                type: 'boolean',
              },
              data: {
                type: 'object',
                properties: {
                  workflow: {
                    type: 'string',
                  },
                  findings: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Finding',
                    },
                  },
                  summary: {
                    $ref: '#/components/schemas/FindingSummary',
                  },
                  duration: {
                    type: 'number',
                  },
                },
              },
              timestamp: {
                type: 'number',
              },
            },
          },
          FindingSummary: {
            type: 'object',
            description: 'Counts of all findings before filters were applied',
            properties: {
              total: { type: 'integer' },
              bySeverity: {
                type: 'object',
                properties: Object.fromEntries(SEVERITIES.map((k) => [k, { type: 'integer' }])),
              },
              byCategory: {
                type: 'object',
                properties: Object.fromEntries(CATEGORIES.map((k) => [k, { type: 'integer' }])),
              },
            },
          },
          FileValidationResult: {
            type: 'object',
            properties: {
              error: {
                type: 'boolean',
              },
              data: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                  },
                  findings: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Finding',
                    },
                  },
                  summary: {
                    $ref: '#/components/schemas/FindingSummary',
                  },
                },
              },
              timestamp: {
                type: 'number',
              },
            },
          },
          TemplateResult: {
            type: 'object',
            properties: {
              error: {
                type: 'boolean',
              },
              data: {
                type: 'object',
                properties: {
                  workflow: {
                    type: 'string',
                  },
                  files: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        path: {
                          type: 'string',
                        },
                        content: {
                          type: 'string',
                        },
                      },
                    },
                  },
                  directories: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                },
              },
              timestamp: {
                type: 'number',
              },
            },
          },
          Finding: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
              },
              severity: {
                type: 'string',
                enum: ['critical', 'important', 'recommended', 'info'],
              },
              category: {
                type: 'string',
                enum: [...CATEGORIES],
              },
              message: {
                type: 'string',
              },
              suggestions: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
          Practice: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
              },
              title: {
                type: 'string',
              },
              workflow: {
                type: 'string',
              },
              category: {
                type: 'string',
              },
              severity: {
                type: 'string',
                enum: [...SEVERITIES],
              },
              enforcement: {
                type: 'string',
                enum: [...ENFORCEMENTS],
                description:
                  "'automated' = a validator rule reports violations; 'guidance' = advice only",
              },
              description: {
                type: 'string',
              },
              examples: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
          PracticesListResult: {
            type: 'object',
            properties: {
              error: {
                type: 'boolean',
              },
              data: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Practice',
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  total: {
                    type: 'number',
                  },
                  limit: {
                    type: 'number',
                  },
                  offset: {
                    type: 'number',
                  },
                  hasMore: {
                    type: 'boolean',
                  },
                },
              },
              timestamp: {
                type: 'number',
              },
            },
          },
          HealthResponse: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                example: 'ok',
              },
              service: {
                type: 'string',
              },
              version: {
                type: 'string',
              },
              timestamp: {
                type: 'string',
              },
              metrics: {
                type: 'object',
              },
            },
          },
        },
        responses: {},
        parameters: {},
      },
    };
  }
}
