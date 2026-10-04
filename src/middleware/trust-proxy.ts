/**
 * Value for Express's `trust proxy` setting, derived from env TRUST_PROXY:
 * - unset, empty or `false`: never trust forwarded headers (default)
 * - `true`: trust every hop (only safe when the server is unreachable except through the proxy)
 * - a non-negative integer: number of proxy hops to trust
 * - anything else (e.g. `loopback`, `10.0.0.0/8`): passed through to Express as a string
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string {
  const v = (value ?? '').trim();
  if (v === '' || v.toLowerCase() === 'false') return false;
  if (v.toLowerCase() === 'true') return true;
  if (/^\d{1,3}$/.test(v)) return parseInt(v, 10);
  return v;
}

/**
 * Logs one warning when requests carry `X-Forwarded-For` although TRUST_PROXY is not set. In that situation every
 * visitor behind the reverse proxy is identified by the proxy's own address, so they all share one rate-limit bucket.
 */
export function proxyMisconfigurationWarning(
  trustProxyEnv: string | undefined,
  warn: (message: string) => void
): (req: { headers: Record<string, unknown> }, res: unknown, next: () => void) => void {
  let warned = false;
  const trusted = parseTrustProxy(trustProxyEnv) !== false;
  return (req, _res, next) => {
    if (!warned && !trusted && req.headers['x-forwarded-for']) {
      warned = true;
      warn(
        'Received X-Forwarded-For but TRUST_PROXY is not set: all clients behind the reverse proxy share one ' +
          "rate-limit bucket (their address is the proxy's). Set TRUST_PROXY=1 (the number of proxies in front " +
          'of this server) when running behind a reverse proxy.'
      );
    }
    next();
  };
}
