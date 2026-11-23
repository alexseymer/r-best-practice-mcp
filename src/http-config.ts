/** Settings of the hosted HTTP server, read from environment variables. Every value has a safe default. */
export interface HttpConfig {
  port: number;
  host: string;
  /** Requests per minute and client for /mcp. 0 turns the limit off. */
  rateLimitPerMinute: number;
  /** Number of reverse proxies in front of the server whose X-Forwarded-For entry is trusted. 0 = none. */
  trustProxyHops: number;
  /** Extra origins allowed to call /mcp from a browser. The server's own origin is always allowed. */
  allowedOrigins: string[];
  build: { commit?: string; builtAt?: string };
}

function integer(value: string | undefined, fallback: number, min = 0): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min ? parsed : fallback;
}

export function readHttpConfig(env: NodeJS.ProcessEnv = process.env): HttpConfig {
  return {
    port: integer(env.PORT, 3000, 0),
    host: env.HOST?.trim() || '0.0.0.0',
    rateLimitPerMinute: integer(env.RATE_LIMIT_PER_MINUTE, 60),
    trustProxyHops: integer(env.TRUST_PROXY, 0),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    build: {
      commit: env.GIT_SHA?.trim() || undefined,
      builtAt: env.BUILD_TIME?.trim() || undefined,
    },
  };
}
