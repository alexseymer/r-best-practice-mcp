/**
 * The hosted server: MCP over Streamable HTTP at POST /mcp, plus GET /health. Requests are stateless, so
 * every POST gets its own short-lived MCP server. The hosted server never reads its own disk for a client
 * (see ServerMode `remote`), and it never logs request bodies.
 */
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { RPracticesMCPServer } from './server.js';
import { RateLimiter } from './rate-limit.js';
import { logger } from './utils/logger.js';

export interface BuildInfo {
  commit?: string;
  builtAt?: string;
}

/** Extra routes (for example the web page). Return true when the request was handled. */
export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) => boolean | Promise<boolean>;

export interface HttpServerOptions {
  version: string;
  build?: BuildInfo;
  rateLimitPerMinute?: number;
  trustProxyHops?: number;
  allowedOrigins?: string[];
  /** Largest accepted request body. check_files allows 1 MB of file text, and JSON escaping adds some. */
  maxBodyBytes?: number;
  /** Requests handled at the same time before the server answers 503. */
  maxConcurrent?: number;
  routes?: RouteHandler[];
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

const jsonRpcError = (code: number, message: string) => ({
  jsonrpc: '2.0',
  error: { code, message },
  id: null,
});

export function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  );
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(text);
}

async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > limit) {
    throw new HttpError(413, 'Request body too large');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** The client address: the socket peer, or the entry a trusted reverse proxy appended to X-Forwarded-For. */
export function clientAddress(req: IncomingMessage, trustProxyHops: number): string {
  if (trustProxyHops > 0) {
    const header = req.headers['x-forwarded-for'];
    const entries = (Array.isArray(header) ? header.join(',') : (header ?? ''))
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (entries.length > 0) return entries[Math.max(0, entries.length - trustProxyHops)];
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/** A browser page may call /mcp only from the server's own origin or an origin on the allow list (DNS rebinding guard). */
function originAllowed(req: IncomingMessage, allowed: string[]): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function createHttpServer(options: HttpServerOptions): Server {
  const limiter = new RateLimiter(options.rateLimitPerMinute ?? 60);
  const maxBody = options.maxBodyBytes ?? 2_000_000;
  const maxConcurrent = options.maxConcurrent ?? 8;
  const hops = options.trustProxyHops ?? 0;
  const allowedOrigins = options.allowedOrigins ?? [];
  const startedAt = Date.now();
  let inFlight = 0;

  async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      sendJson(res, 405, jsonRpcError(-32000, 'Method not allowed. Send MCP requests with POST.'));
      return;
    }
    if (!originAllowed(req, allowedOrigins)) {
      sendJson(res, 403, jsonRpcError(-32000, 'Origin not allowed'));
      return;
    }

    const verdict = limiter.check(clientAddress(req, hops));
    if (!verdict.allowed) {
      sendJson(res, 429, jsonRpcError(-32000, 'Too many requests. Try again later.'), {
        'Retry-After': String(verdict.retryAfterSeconds),
      });
      return;
    }
    if (inFlight >= maxConcurrent) {
      sendJson(res, 503, jsonRpcError(-32000, 'The server is busy. Try again in a moment.'), {
        'Retry-After': '1',
      });
      return;
    }

    inFlight += 1;
    try {
      const raw = await readBody(req, maxBody);
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        sendJson(res, 400, jsonRpcError(-32700, 'Parse error: the body is not valid JSON'));
        return;
      }

      const mcp = new RPracticesMCPServer({ mode: 'remote' });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on('close', () => {
        void transport.close();
        void mcp.close();
      });
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
    } finally {
      inFlight -= 1;
    }
  }

  const server = createServer(async (req, res) => {
    const started = Date.now();
    applySecurityHeaders(res);
    const url = new URL(req.url ?? '/', 'http://localhost');

    res.on('finish', () => {
      logger.info(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
    });

    try {
      if (url.pathname === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
        sendJson(res, 200, {
          status: 'ok',
          version: options.version,
          mode: 'remote',
          build: { commit: options.build?.commit ?? null, builtAt: options.build?.builtAt ?? null },
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        });
        return;
      }
      if (url.pathname === '/mcp') {
        await handleMcp(req, res);
        return;
      }
      for (const route of options.routes ?? []) {
        if (await route(req, res, url)) return;
      }
      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      if (error instanceof HttpError) {
        if (!res.headersSent) sendJson(res, error.status, jsonRpcError(-32000, error.message), { Connection: 'close' });
        return;
      }
      // A client that hangs up in the middle of its request is not a server error, and nobody is left to answer.
      if ((error as NodeJS.ErrnoException).code === 'ECONNRESET' || req.destroyed) {
        logger.info('Client closed the connection before the request was complete');
        return;
      }
      logger.error('Request failed', error);
      if (!res.headersSent) sendJson(res, 500, jsonRpcError(-32603, 'Internal error'));
      else res.end();
    }
  });

  // A free public server should not hold slow or stalled connections open.
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  return server;
}
