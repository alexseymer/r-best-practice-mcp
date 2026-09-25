export interface MCPError {
  error: true;
  code: string;
  message: string;
  details?: string;
}

export interface MCPSuccess<T> {
  error?: false;
  data: T;
  timestamp: number;
}

export type MCPResponse<T> = MCPSuccess<T> | MCPError;

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number;
  hash?: string;
}

export interface ToolInput {
  path: string;
  [key: string]: unknown;
}
