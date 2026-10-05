import { Request, Response, NextFunction } from 'express';

/**
 * Content-Security-Policy directives, one constant per page family.
 *
 * Everything the dashboard and the API docs load is self-hosted (precompiled Tailwind CSS, woff2 fonts,
 * SVG icon sprite, swagger-ui-dist), so every fetch directive is 'self' only: no third-party origins, no
 * 'unsafe-inline' and no 'unsafe-eval'. The pages contain no inline <script>/<style> and no inline event
 * handler or style attributes; dashboard.js applies dynamic styles through the CSSOM (element.style), which CSP
 * allows. `data:` is allowed for images only (swagger-ui-dist embeds small data: URI images).
 */
export const DASHBOARD_CSP: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'font-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

/** `/api-docs` (Swagger UI) is served from the same origin too, so it uses the same policy. */
export const API_DOCS_CSP: Readonly<Record<string, readonly string[]>> = DASHBOARD_CSP;

/** Path -> policy overrides; every other path uses DASHBOARD_CSP. */
export const CSP_BY_PATH: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  '/api-docs': API_DOCS_CSP,
};

export function buildCsp(directives: Readonly<Record<string, readonly string[]>>): string {
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(' '))
    .join('; ');
}

export function cspForPath(requestPath: string): string {
  return buildCsp(CSP_BY_PATH[requestPath] ?? DASHBOARD_CSP);
}

export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), interest-cohort=()';
export const HSTS_VALUE = 'max-age=31536000; includeSubDomains';

/**
 * Security headers for every response. HSTS is only sent for HTTPS requests; `req.secure` honours
 * `X-Forwarded-Proto` solely when `trust proxy` is configured (env TRUST_PROXY), so a client cannot
 * trigger it over plain HTTP by spoofing a header.
 */
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', cspForPath(req.path));
    if (req.secure) {
      res.setHeader('Strict-Transport-Security', HSTS_VALUE);
    }
    next();
  };
}

const NO_STORE_ROOTS = ['/api', '/health', '/metrics'];

/** `Cache-Control: no-store` for dynamic endpoints (API, health, metrics); static files keep ETags. */
export function noStore() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const p = req.path;
    if (NO_STORE_ROOTS.some((root) => p === root || p.startsWith(root + '/'))) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  };
}
