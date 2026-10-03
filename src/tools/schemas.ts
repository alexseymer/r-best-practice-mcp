/**
 * Single source of truth for the tool surface: names, descriptions, REST routes and parameters.
 *
 * Everything that advertises tools derives from `TOOL_DEFS`:
 *  - the MCP `tools/list` response (`toMcpTools`)
 *  - the REST `GET /api/tools` payload (`toRestToolsPayload`)
 *  - the OpenAPI document (`toOpenApiOperationParts` and friends)
 *
 * To add or change a parameter, edit it here only.
 */
import { CATEGORIES, SEVERITIES } from '../types/finding.js';
import { ENFORCEMENTS } from '../types/practice.js';
import { VALID_WORKFLOWS } from '../utils/security.js';
import { MAX_FINDINGS_LIMIT, PRACTICE_LIMIT_MAX } from '../utils/query-params.js';

export type ToolParamType = 'string' | 'integer' | 'array';

export interface ToolParam {
  type: ToolParamType;
  description: string;
  required?: boolean;
  /** Allowed values (for `array`, the allowed item values). */
  enum?: readonly string[];
  minimum?: number;
  maximum?: number;
  /** Item type for `array` parameters. */
  items?: { type: 'string' };
  /** Additional REST names accepted for the same parameter (e.g. `q` for `query`). */
  aliases?: readonly string[];
}

export interface ToolDef {
  /** MCP tool name (snake_case). */
  name: string;
  description: string;
  /** REST method and unversioned path; `/api/v1/...` is derived. `:id` marks a path parameter. */
  method: 'GET' | 'POST';
  path: string;
  /** OpenAPI metadata. */
  operationId: string;
  summary: string;
  tag: string;
  params: Record<string, ToolParam>;
  /** REST-only OpenAPI query parameters on the /api/v1 route (not MCP tool parameters). */
  v1ExtraQueryParams?: Record<string, ToolParam>;
}

const FILTER_PARAMS: Record<string, ToolParam> = {
  minSeverity: {
    type: 'string',
    description:
      'Only return findings at least this severe (critical > important > recommended > info)',
    enum: SEVERITIES,
  },
  categories: {
    type: 'array',
    items: { type: 'string' },
    description: 'Only return findings in these categories (omit for all categories)',
    enum: CATEGORIES,
  },
  maxFindings: {
    type: 'integer',
    description: `Return at most this many findings after other filters (1-${MAX_FINDINGS_LIMIT}). The summary still counts all findings.`,
    minimum: 1,
    maximum: MAX_FINDINGS_LIMIT,
  },
};

export const TOOL_DEFS: readonly ToolDef[] = [
  {
    name: 'detect_workflow',
    description: 'Detect the R workflow type from a directory path',
    method: 'POST',
    path: '/api/detect-workflow',
    operationId: 'detectWorkflow',
    summary: 'Detect Workflow Type',
    tag: 'Workflows',
    params: {
      path: { type: 'string', description: 'Directory path to analyze', required: true },
    },
  },
  {
    name: 'validate_project',
    description:
      'Validate an R project against best practices. Optional filters narrow the returned findings; the summary always counts all findings.',
    method: 'POST',
    path: '/api/validate-project',
    operationId: 'validateProject',
    summary: 'Validate Project',
    tag: 'Validation',
    params: {
      path: { type: 'string', description: 'Directory path to validate', required: true },
      workflow: {
        type: 'string',
        description: 'Optional workflow type (auto-detected if omitted)',
        enum: VALID_WORKFLOWS,
      },
      ...FILTER_PARAMS,
    },
  },
  {
    name: 'validate_file',
    description:
      'Validate a single R or Quarto file. Optional filters narrow the returned findings; the summary always counts all findings.',
    method: 'POST',
    path: '/api/validate-file',
    operationId: 'validateFile',
    summary: 'Validate File',
    tag: 'Validation',
    params: {
      path: { type: 'string', description: 'File path to validate', required: true },
      ...FILTER_PARAMS,
    },
  },
  {
    name: 'get_practice',
    description: 'Get details about a specific best practice',
    method: 'GET',
    path: '/api/practice/:id',
    operationId: 'getPractice',
    summary: 'Get Practice Details',
    tag: 'Practices',
    params: {
      id: { type: 'string', description: 'Practice ID', required: true },
    },
  },
  {
    name: 'list_practices',
    description:
      'List best practices, optionally filtered by workflow, category, minimum severity, tags, enforcement type (automated check or guidance only) or free-text query',
    method: 'GET',
    path: '/api/practices',
    operationId: 'listPractices',
    summary: 'List Best Practices',
    tag: 'Practices',
    params: {
      workflow: {
        type: 'string',
        description: 'Optional workflow type (r-script, quarto, shiny, package, etc.)',
        enum: VALID_WORKFLOWS,
      },
      category: {
        type: 'string',
        description: 'Optional category (structure, naming, documentation, etc.)',
        enum: CATEGORIES,
      },
      minSeverity: {
        type: 'string',
        description:
          'Only practices at least this severe (critical > important > recommended > info)',
        enum: SEVERITIES,
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Only practices having at least one of these tags (REST: comma separated list)',
      },
      enforcement: {
        type: 'string',
        description: "'automated' = a validator rule reports violations; 'guidance' = advice only",
        enum: ENFORCEMENTS,
      },
      query: {
        type: 'string',
        description:
          'Case-insensitive text search over id, title, description, details and tags (REST alias: q)',
        aliases: ['q'],
      },
      limit: {
        type: 'integer',
        description: `Maximum number of practices to return (1-${PRACTICE_LIMIT_MAX}). On /api/v1 this is the page size, capped at 100.`,
        minimum: 1,
        maximum: PRACTICE_LIMIT_MAX,
      },
    },
    v1ExtraQueryParams: {
      offset: {
        type: 'integer',
        description: 'Number of results to skip (default: 0)',
        minimum: 0,
      },
    },
  },
  {
    name: 'generate_template',
    description: 'Generate a project template for a specific R workflow',
    method: 'POST',
    path: '/api/generate-template',
    operationId: 'generateTemplate',
    summary: 'Generate Project Template',
    tag: 'Templates',
    params: {
      workflow: {
        type: 'string',
        description:
          'Workflow type (r-script, quarto, shiny, package, rmarkdown, renv, targets, plumber, analysis)',
        required: true,
      },
      projectName: { type: 'string', description: 'Optional name for the project' },
      authorName: { type: 'string', description: 'Optional author name' },
      authorEmail: { type: 'string', description: 'Optional author email' },
    },
  },
];

export function getToolDef(name: string): ToolDef | undefined {
  return TOOL_DEFS.find((t) => t.name === name);
}

/** JSON-schema fragment for one parameter (shared by MCP and OpenAPI). */
export function paramToJsonSchema(param: ToolParam): Record<string, unknown> {
  const schema: Record<string, unknown> = { type: param.type, description: param.description };
  if (param.type === 'array') {
    const items: Record<string, unknown> = { type: param.items?.type ?? 'string' };
    if (param.enum) items.enum = [...param.enum];
    schema.items = items;
  } else if (param.enum) {
    schema.enum = [...param.enum];
  }
  if (param.minimum !== undefined) schema.minimum = param.minimum;
  if (param.maximum !== undefined) schema.maximum = param.maximum;
  return schema;
}

/** MCP `inputSchema` for a tool. */
export function toInputSchema(tool: ToolDef): {
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
} {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];
  for (const [name, param] of Object.entries(tool.params)) {
    properties[name] = paramToJsonSchema(param);
    if (param.required) required.push(name);
  }
  return {
    type: 'object' as const,
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/** The MCP `tools/list` payload. */
export function toMcpTools(): Array<{
  name: string;
  description: string;
  inputSchema: ReturnType<typeof toInputSchema>;
}> {
  return TOOL_DEFS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: toInputSchema(tool),
  }));
}

/** The REST `GET /api/tools` payload (`data` array). */
export function toRestToolsPayload(): Array<{
  name: string;
  method: string;
  path: string;
  description: string;
  parameters: Record<string, Record<string, unknown>>;
}> {
  return TOOL_DEFS.map((tool) => ({
    name: tool.name,
    method: tool.method,
    path: tool.path,
    description: tool.description,
    parameters: Object.fromEntries(
      Object.entries(tool.params).map(([name, param]) => [
        name,
        {
          ...paramToJsonSchema(param),
          required: !!param.required,
          ...(param.aliases ? { aliases: [...param.aliases] } : {}),
        },
      ])
    ),
  }));
}

/** `/api/practice/:id` -> `/api/v1/practice/{id}` */
export function toOpenApiPath(tool: ToolDef): string {
  return tool.path.replace(/^\/api\//, '/api/v1/').replace(/:(\w+)/g, '{$1}');
}

/** Name of the request-body component schema for a POST tool, e.g. `ValidateProjectRequest`. */
export function requestSchemaName(tool: ToolDef): string {
  return tool.operationId.charAt(0).toUpperCase() + tool.operationId.slice(1) + 'Request';
}

/** Body schema for a POST tool (goes under components.schemas). */
export function toOpenApiRequestSchema(tool: ToolDef): Record<string, unknown> {
  const required = Object.entries(tool.params)
    .filter(([, p]) => p.required)
    .map(([name]) => name);
  return {
    type: 'object',
    ...(required.length > 0 ? { required } : {}),
    properties: Object.fromEntries(
      Object.entries(tool.params).map(([name, p]) => [name, paramToJsonSchema(p)])
    ),
  };
}

/** OpenAPI `parameters` array for a GET tool (path + query, aliases and v1-only extras included). */
export function toOpenApiParameters(tool: ToolDef): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const pathNames = new Set([...tool.path.matchAll(/:(\w+)/g)].map((m) => m[1]));
  for (const [name, param] of Object.entries(tool.params)) {
    const location = pathNames.has(name) ? 'path' : 'query';
    const { description, ...schema } = paramToJsonSchema(param);
    out.push({
      name,
      in: location,
      ...(location === 'path' || param.required ? { required: true } : {}),
      description,
      schema,
      ...(param.type === 'array' ? { style: 'form', explode: false } : {}),
    });
    for (const alias of param.aliases ?? []) {
      out.push({
        name: alias,
        in: location,
        description: `Alias of \`${name}\``,
        schema: { type: param.type },
      });
    }
  }
  for (const [name, param] of Object.entries(tool.v1ExtraQueryParams ?? {})) {
    const { description, ...schema } = paramToJsonSchema(param);
    out.push({ name, in: 'query', description, schema });
  }
  return out;
}
