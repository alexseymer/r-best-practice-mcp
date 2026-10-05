const STATIC_FILES = new Set([
  '/dashboard.css',
  '/dashboard.js',
  '/icons.svg',
  '/favicon.svg',
  '/api-docs-init.js',
]);
const STATIC_PREFIXES = ['/fonts/', '/api-docs/assets/'];

/**
 * True for the fixed, self-hosted front-end files (stylesheet, script, icon sprite, fonts, Swagger UI).
 * The dashboard now serves everything itself, so one page view costs ~15 requests; counting those against the
 * per-IP API rate limit would lock out normal visitors after a few page loads. These files are cheap, cacheable
 * and not user-controlled, so they are exempt. The pages themselves and every API route stay limited.
 */
export function isStaticAssetPath(method: string, requestPath: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (requestPath.includes('..')) return false;
  return STATIC_FILES.has(requestPath) || STATIC_PREFIXES.some((p) => requestPath.startsWith(p));
}
