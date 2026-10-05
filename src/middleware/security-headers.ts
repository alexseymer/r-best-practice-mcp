import { Request, Response, NextFunction } from 'express';

/**
 * Content-Security-Policy directives, one constant per page family.
 *
 * DASHBOARD_CSP allows exactly what `src/public/dashboard.html` loads today:
 * - script: same origin, the inline Tailwind config script and `cdn.tailwindcss.com`
 * - style: same origin, inline styles (Tailwind's runtime injects <style>) and Google Fonts CSS
 * - font: `fonts.gstatic.com`
 * - img: same origin and `data:`
 * - connect: same origin (the dashboard only calls its own API)
 *
 * When the third-party assets are self-hosted, remove `cdn.tailwindcss.com`, `fonts.googleapis.com`
 * and `fonts.gstatic.com` here (and `'unsafe-inline'` once Tailwind is precompiled).
 */
export const DASHBOARD_CSP: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ['https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

/** `/api-docs` (Swagger UI) additionally loads its script and stylesheet from cdn.jsdelivr.net. */
export const API_DOCS_CSP: Readonly<Record<string, readonly string[]>> = {
  ...DASHBOARD_CSP,
  'script-src': [...DASHBOARD_CSP['script-src'], 'https://cdn.jsdelivr.net'],
  'style-src': [...DASHBOARD_CSP['style-src'], 'https://cdn.jsdelivr.net'],
};

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
