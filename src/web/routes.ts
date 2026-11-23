/**
 * The page and its two read-only JSON endpoints: GET / (practices, system status, setup), GET /api/practices and
 * GET /api/system. Assets are built once at start and served with gzip and an ETag.
 */
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { IncomingMessage, ServerResponse } from 'node:http';
import { kb } from '../data/knowledge-base.js';
import { toolsFor } from '../tools/schemas.js';
import { FILE_LIMITS } from '../check-files.js';
import type { BuildInfo, RouteHandler } from '../http-server.js';
import { INDEX_HTML } from './index-html.js';
import { APP_CSS } from './app-css.js';
import { APP_JS } from './app-js.js';

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0f766e"/><text x="16" y="23" font-family="system-ui,sans-serif" font-size="20" font-weight="700" text-anchor="middle" fill="#fff">R</text></svg>`;

export interface WebOptions {
  version: string;
  build?: BuildInfo;
  rateLimitPerMinute: number;
  maxBodyBytes: number;
  /** npm install spec for the local setup instructions. */
  localPackage: string;
  startedAt?: number;
}

interface Asset {
  type: string;
  body: Buffer;
  gzip: Buffer;
  etag: string;
}

function asset(type: string, text: string): Asset {
  const body = Buffer.from(text, 'utf8');
  return {
    type,
    body,
    gzip: gzipSync(body),
    etag: `"${createHash('sha1').update(body).digest('hex').slice(0, 20)}"`,
  };
}

function serve(req: IncomingMessage, res: ServerResponse, item: Asset): void {
  res.setHeader('ETag', item.etag);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Vary', 'Accept-Encoding');
  if (req.headers['if-none-match'] === item.etag) {
    res.writeHead(304);
    res.end();
    return;
  }
  const gzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
  const body = gzip ? item.gzip : item.body;
  res.writeHead(200, {
    'Content-Type': item.type,
    'Content-Length': body.length,
    ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

export function createWebRoutes(options: WebOptions): RouteHandler {
  const startedAt = options.startedAt ?? Date.now();
  const html = 'text/html; charset=utf-8';
  const json = 'application/json; charset=utf-8';

  const practices = kb.listPractices({}).practices;
  const staticAssets = new Map<string, Asset>([
    ['/', asset(html, INDEX_HTML)],
    ['/app.css', asset('text/css; charset=utf-8', APP_CSS)],
    ['/app.js', asset('text/javascript; charset=utf-8', APP_JS)],
    ['/favicon.svg', asset('image/svg+xml', FAVICON_SVG)],
    ['/api/practices', asset(json, JSON.stringify({ count: practices.length, practices }))],
  ]);

  function systemInfo() {
    const automated = practices.filter((p) => p.enforcement === 'automated').length;
    const byWorkflow = new Map<string, number>();
    for (const p of practices) byWorkflow.set(p.workflow, (byWorkflow.get(p.workflow) ?? 0) + 1);

    return {
      status: 'ok',
      version: options.version,
      mode: 'remote',
      build: { commit: options.build?.commit ?? null, builtAt: options.build?.builtAt ?? null },
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      practices: {
        total: practices.length,
        automated,
        guidance: practices.length - automated,
        workflows: [...byWorkflow.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([id, count]) => ({ id, count })),
      },
      tools: toolsFor('remote').map((tool) => ({ name: tool.name, description: tool.description ?? '' })),
      limits: {
        rateLimitPerMinute: options.rateLimitPerMinute,
        maxBodyBytes: options.maxBodyBytes,
        maxFiles: FILE_LIMITS.maxFiles,
        maxFileBytes: FILE_LIMITS.maxFileBytes,
        maxTotalBytes: FILE_LIMITS.maxTotalBytes,
      },
      endpoints: { mcp: '/mcp', health: '/health' },
      localInstall: { package: options.localPackage, bin: 'r-best-practices-mcp' },
    };
  }

  return (req, res, url) => {
    const known = staticAssets.has(url.pathname) || url.pathname === '/api/system' || url.pathname === '/dashboard';
    if (!known) return false;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method not allowed');
      return true;
    }

    if (url.pathname === '/dashboard') {
      res.writeHead(302, { Location: '/' });
      res.end();
      return true;
    }
    if (url.pathname === '/api/system') {
      const text = JSON.stringify(systemInfo());
      res.writeHead(200, {
        'Content-Type': json,
        'Content-Length': Buffer.byteLength(text),
        'Cache-Control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : text);
      return true;
    }

    serve(req, res, staticAssets.get(url.pathname)!);
    return true;
  };
}
