import { readHttpConfig } from '../../src/http-config';

describe('readHttpConfig', () => {
  it('has safe defaults', () => {
    expect(readHttpConfig({})).toEqual({
      port: 3000,
      host: '0.0.0.0',
      rateLimitPerMinute: 60,
      trustProxyHops: 0,
      allowedOrigins: [],
      localPackage: 'github:alexseymer/r-best-practice-mcp',
      build: { commit: undefined, builtAt: undefined },
    });
  });

  it('reads the settings from the environment', () => {
    const config = readHttpConfig({
      PORT: '8080',
      HOST: '127.0.0.1',
      RATE_LIMIT_PER_MINUTE: '10',
      TRUST_PROXY: '1',
      ALLOWED_ORIGINS: 'https://a.example, https://b.example',
      LOCAL_PACKAGE: 'r-best-practices-mcp@0.9.0',
      GIT_SHA: 'abc123',
      BUILD_TIME: '2026-11-23T10:00:00Z',
    });
    expect(config).toMatchObject({
      port: 8080,
      host: '127.0.0.1',
      rateLimitPerMinute: 10,
      trustProxyHops: 1,
      allowedOrigins: ['https://a.example', 'https://b.example'],
      localPackage: 'r-best-practices-mcp@0.9.0',
      build: { commit: 'abc123', builtAt: '2026-11-23T10:00:00Z' },
    });
  });

  it.each(['abc', '-5', '1.5', ''])('falls back to the default for the invalid value "%s"', (value) => {
    const config = readHttpConfig({ PORT: value, RATE_LIMIT_PER_MINUTE: value, TRUST_PROXY: value });
    expect(config.port).toBe(3000);
    expect(config.rateLimitPerMinute).toBe(60);
    expect(config.trustProxyHops).toBe(0);
  });
});
