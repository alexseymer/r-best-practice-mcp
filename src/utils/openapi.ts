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
  static generateSpec(version: string = '0.2.0', baseUrl: string = 'http://localhost:3000'): OpenAPISpec {
    return {
      openapi: '3.0.0',
      info: {
        title: 'R Best Practices MCP Server',
        version,
        description:
          'API for workflow detection, project validation, template generation, and best practices knowledge base for R development',
        contact: {
          name: 'Alex Seymer',
          email: 'alexseymer@gmail.com',
          url: 'https://github.com/alexseymer/r-coding-mcp',
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
        '/api/v1/detect-workflow': {
          post: {
            summary: 'Detect Workflow Type',
            description: 'Automatically detect the R workflow type from a directory path',
            operationId: 'detectWorkflow',
            tags: ['Workflows'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/DetectWorkflowRequest',
                  },
                },
              },
            },
            responses: {
              200: {
                description: 'Workflow detected successfully',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/DetectionResult',
                    },
                  },
                },
              },
              400: {
                description: 'Invalid input or missing parameters',
              },
              500: {
                description: 'Server error during detection',
              },
            },
          },
        },
        '/api/v1/validate-project': {
          post: {
            summary: 'Validate Project',
            description: 'Validate an R project against best practices',
            operationId: 'validateProject',
            tags: ['Validation'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ValidateProjectRequest',
                  },
                },
              },
            },
            responses: {
              200: {
                description: 'Project validation completed',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/ValidationResult',
                    },
                  },
                },
              },
              400: {
                description: 'Invalid input or parameters',
              },
              404: {
                description: 'Project directory not found',
              },
              500: {
                description: 'Server error during validation',
              },
            },
          },
        },
        '/api/v1/validate-file': {
          post: {
            summary: 'Validate File',
            description: 'Validate a single R or Quarto file against best practices',
            operationId: 'validateFile',
            tags: ['Validation'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ValidateFileRequest',
                  },
                },
              },
            },
            responses: {
              200: {
                description: 'File validation completed',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/FileValidationResult',
                    },
                  },
                },
              },
              400: {
                description: 'Invalid input or parameters',
              },
              404: {
                description: 'File not found',
              },
              500: {
                description: 'Server error during validation',
              },
            },
          },
        },
        '/api/v1/generate-template': {
          post: {
            summary: 'Generate Project Template',
            description: 'Generate a complete project scaffold for a specific R workflow',
            operationId: 'generateTemplate',
            tags: ['Templates'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/GenerateTemplateRequest',
                  },
                },
              },
            },
            responses: {
              200: {
                description: 'Template generated successfully',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/TemplateResult',
                    },
                  },
                },
              },
              400: {
                description: 'Invalid workflow type',
              },
              500: {
                description: 'Server error during generation',
              },
            },
          },
        },
        '/api/v1/practices': {
          get: {
            summary: 'List Best Practices',
            description: 'List best practices, optionally filtered by workflow or category',
            operationId: 'listPractices',
            tags: ['Practices'],
            parameters: [
              {
                name: 'workflow',
                in: 'query',
                description: 'Filter by workflow type',
                schema: {
                  type: 'string',
                  enum: [
                    'r-script',
                    'quarto',
                    'shiny',
                    'package',
                    'rmarkdown',
                    'renv',
                    'targets',
                    'plumber',
                    'analysis',
                    'bookdown',
                    'blogdown',
                    'shinytest',
                  ],
                },
              },
              {
                name: 'category',
                in: 'query',
                description: 'Filter by practice category',
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'limit',
                in: 'query',
                description: 'Maximum number of results (default: 50)',
                schema: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 100,
                },
              },
              {
                name: 'offset',
                in: 'query',
                description: 'Number of results to skip (default: 0)',
                schema: {
                  type: 'integer',
                  minimum: 0,
                },
              },
            ],
            responses: {
              200: {
                description: 'List of practices',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/PracticesListResult',
                    },
                  },
                },
              },
              400: {
                description: 'Invalid filter parameters',
              },
              500: {
                description: 'Server error',
              },
            },
          },
        },
        '/api/v1/practice/{id}': {
          get: {
            summary: 'Get Practice Details',
            description: 'Get detailed information about a specific best practice',
            operationId: 'getPractice',
            tags: ['Practices'],
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                description: 'Practice ID',
                schema: {
                  type: 'string',
                },
              },
            ],
            responses: {
              200: {
                description: 'Practice details',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Practice',
                    },
                  },
                },
              },
              404: {
                description: 'Practice not found',
              },
              500: {
                description: 'Server error',
              },
            },
          },
        },
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
          DetectWorkflowRequest: {
            type: 'object',
            required: ['path'],
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to analyze',
                example: '/path/to/my-project',
              },
            },
          },
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
          ValidateProjectRequest: {
            type: 'object',
            required: ['path'],
            properties: {
              path: {
                type: 'string',
                description: 'Project directory path',
              },
              workflow: {
                type: 'string',
                description: 'Optional workflow type (auto-detected if not provided)',
              },
            },
          },
          ValidateFileRequest: {
            type: 'object',
            required: ['path'],
            properties: {
              path: {
                type: 'string',
                description: 'File path to validate',
              },
            },
          },
          GenerateTemplateRequest: {
            type: 'object',
            required: ['workflow'],
            properties: {
              workflow: {
                type: 'string',
                description: 'Workflow type for template',
              },
              projectName: {
                type: 'string',
                description: 'Optional project name',
              },
              authorName: {
                type: 'string',
                description: 'Optional author name',
              },
              authorEmail: {
                type: 'string',
                description: 'Optional author email',
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
