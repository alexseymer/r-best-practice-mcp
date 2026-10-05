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
