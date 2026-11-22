import { getRuntimeConfig } from '../../src/config/runtime';

const env = (e: Record<string, string>): NodeJS.ProcessEnv => e as NodeJS.ProcessEnv;

describe('getRuntimeConfig', () => {
  it('reports the package version as a non-empty string', () => {
    const cfg = getRuntimeConfig(env({}));
    expect(typeof cfg.version).toBe('string');
    expect(cfg.version.length).toBeGreaterThan(0);
  });

  it('reports no build information when the build variables are unset', () => {
    expect(getRuntimeConfig(env({})).build).toEqual({ commit: null, builtAt: null });
  });

  it('reads GIT_SHA and BUILD_TIME, trimmed', () => {
    const cfg = getRuntimeConfig(env({ GIT_SHA: ' abc123 ', BUILD_TIME: '2026-11-20T00:00:00Z' }));
    expect(cfg.build).toEqual({ commit: 'abc123', builtAt: '2026-11-20T00:00:00Z' });
  });
});
