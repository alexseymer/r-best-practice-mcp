import path from 'path';
import { getRuntimeConfig, LARGE_BODY_ROUTES, UPLOAD_LIMITS } from '../../src/config/runtime';

const env = (e: Record<string, string>): NodeJS.ProcessEnv => e as NodeJS.ProcessEnv;

describe('getRuntimeConfig', () => {
  describe('serverPaths', () => {
    it('is unrestricted outside production', () => {
      expect(getRuntimeConfig(env({})).serverPaths).toEqual({ unrestricted: true, roots: [] });
    });

    it('defaults to /projects in production', () => {
      expect(getRuntimeConfig(env({ NODE_ENV: 'production' })).serverPaths).toEqual({
        unrestricted: false,
        roots: [path.resolve('/projects')],
      });
    });

    it('uses ALLOWED_PROJECT_ROOTS (comma separated, trimmed, resolved)', () => {
      const cfg = getRuntimeConfig(
        env({ NODE_ENV: 'production', ALLOWED_PROJECT_ROOTS: ' /srv/a , /srv/b/ ,' })
      );
      expect(cfg.serverPaths).toEqual({
        unrestricted: false,
        roots: [path.resolve('/srv/a'), path.resolve('/srv/b')],
      });
    });

    it('ALLOW_ANY_PATH=true lifts the restriction even in production', () => {
      const cfg = getRuntimeConfig(
        env({ NODE_ENV: 'production', ALLOW_ANY_PATH: 'true', ALLOWED_PROJECT_ROOTS: '/srv/a' })
      );
      expect(cfg.serverPaths).toEqual({ unrestricted: true, roots: [] });
    });

    it('only the literal string "true" counts for ALLOW_ANY_PATH', () => {
      expect(
        getRuntimeConfig(env({ NODE_ENV: 'production', ALLOW_ANY_PATH: '1' })).serverPaths
          .unrestricted
      ).toBe(false);
    });
  });

  describe('metrics', () => {
    it('is public outside production', () => {
      expect(getRuntimeConfig(env({})).metrics).toEqual({ public: true, tokenRequired: false });
    });

    it('is disabled in production without a token', () => {
      expect(getRuntimeConfig(env({ NODE_ENV: 'production' })).metrics).toEqual({
        public: false,
        tokenRequired: false,
      });
    });

    it('requires a token when METRICS_TOKEN is set', () => {
      expect(getRuntimeConfig(env({ METRICS_TOKEN: 's3cret' })).metrics).toEqual({
        public: false,
        tokenRequired: true,
      });
      expect(
        getRuntimeConfig(env({ NODE_ENV: 'production', METRICS_TOKEN: 's3cret' })).metrics
          .tokenRequired
      ).toBe(true);
    });

    it('ignores a blank token', () => {
      expect(getRuntimeConfig(env({ METRICS_TOKEN: '   ' })).metrics.tokenRequired).toBe(false);
    });

    it('METRICS_PUBLIC=true makes it public in production', () => {
      expect(
        getRuntimeConfig(env({ NODE_ENV: 'production', METRICS_PUBLIC: 'true' })).metrics
      ).toEqual({
        public: true,
        tokenRequired: false,
      });
    });
  });

  describe('build and version', () => {
    it('reports build info from the environment, null otherwise', () => {
      expect(getRuntimeConfig(env({})).build).toEqual({ commit: null, builtAt: null });
      expect(
        getRuntimeConfig(env({ GIT_SHA: 'abc1234', BUILD_TIME: '2026-10-04T21:00:00Z' })).build
      ).toEqual({
        commit: 'abc1234',
        builtAt: '2026-10-04T21:00:00Z',
      });
    });

    it('reads the version from package.json', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = JSON.parse(
        require('fs').readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
      );
      expect(getRuntimeConfig(env({})).version).toBe(pkg.version);
    });
  });

  it('exposes the upload limits', () => {
    const { upload } = getRuntimeConfig(env({}));
    expect(upload.enabled).toBe(true);
    expect(upload.maxFiles).toBe(UPLOAD_LIMITS.maxFiles);
    expect(upload.allowedExtensions).toContain('.r');
    expect(upload.allowedFileNames).toContain('DESCRIPTION');
  });
});

describe('LARGE_BODY_ROUTES', () => {
  it('allows the upload route more than the total upload limit', () => {
    expect(LARGE_BODY_ROUTES['/api/validate-upload']).toBeGreaterThan(UPLOAD_LIMITS.maxTotalBytes);
  });
});
