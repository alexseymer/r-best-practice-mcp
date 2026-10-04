import { proxyMisconfigurationWarning } from '../../src/middleware/trust-proxy';

function run(env: string | undefined, headers: Record<string, unknown>, times = 1) {
  const warn = jest.fn();
  const mw = proxyMisconfigurationWarning(env, warn);
  const next = jest.fn();
  for (let i = 0; i < times; i++) mw({ headers }, {}, next);
  return { warn, next };
}

describe('proxyMisconfigurationWarning', () => {
  it('warns once when X-Forwarded-For arrives and TRUST_PROXY is unset', () => {
    const { warn, next } = run(undefined, { 'x-forwarded-for': '203.0.113.7' }, 3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('TRUST_PROXY=1');
    expect(next).toHaveBeenCalledTimes(3);
  });

  it.each(['', 'false'])('also warns for TRUST_PROXY=%p', (value) => {
    expect(run(value, { 'x-forwarded-for': '203.0.113.7' }).warn).toHaveBeenCalledTimes(1);
  });

  it('stays quiet without the header', () => {
    expect(run(undefined, {}).warn).not.toHaveBeenCalled();
  });

  it.each(['1', '2', 'true', 'loopback'])('stays quiet when TRUST_PROXY=%s', (value) => {
    expect(run(value, { 'x-forwarded-for': '203.0.113.7' }).warn).not.toHaveBeenCalled();
  });
});
