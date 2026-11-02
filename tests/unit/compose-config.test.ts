import * as fs from 'fs';
import * as path from 'path';

/**
 * docker-compose.yml puts nginx in front of the API. The API must trust exactly that one proxy hop, and
 * must not be reachable around the proxy: otherwise a client could spoof X-Forwarded-For and escape the
 * per-client rate limit.
 */
const compose = fs.readFileSync(path.resolve(__dirname, '../../docker-compose.yml'), 'utf-8');

/** Lines of the `api:` service, from its header to the next top-level service. */
function apiService(text: string): string {
  const start = text.indexOf('\n  api:');
  const end = text.indexOf('\n  nginx:');
  return start >= 0 && end > start ? text.slice(start, end) : '';
}

describe('docker-compose.yml', () => {
  it('has an api service and an nginx service in front of it', () => {
    expect(apiService(compose)).not.toBe('');
    expect(compose).toMatch(/\n {2}nginx:/);
  });

  it('trusts exactly one proxy hop', () => {
    expect(apiService(compose)).toMatch(/^\s+- TRUST_PROXY=1$/m);
  });

  it('publishes the API on loopback only, not on all interfaces', () => {
    const api = apiService(compose);
    expect(api).toMatch(/"127\.0\.0\.1:3000:3000"/);
    expect(api).not.toMatch(/- "3000:3000"/);
  });
});
