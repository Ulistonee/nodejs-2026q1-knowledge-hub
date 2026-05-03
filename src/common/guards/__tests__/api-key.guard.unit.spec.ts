import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiKeyGuard } from '../api-key.guard';

const buildContext = (request: Record<string, unknown>): ExecutionContext => {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
};

describe('ApiKeyGuard (unit)', () => {
  let guard: ApiKeyGuard;
  const originalApiKey = process.env.API_KEY;

  beforeEach(() => {
    guard = new ApiKeyGuard();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalApiKey;
    }
  });

  it('allows everything when API_KEY is not set', () => {
    delete process.env.API_KEY;
    expect(
      guard.canActivate(
        buildContext({ path: '/foo', headers: {} }),
      ),
    ).toBe(true);
  });

  it('always allows /health and /doc paths', () => {
    process.env.API_KEY = 'secret';
    expect(
      guard.canActivate(
        buildContext({ path: '/health', headers: {} }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(buildContext({ path: '/doc', headers: {} })),
    ).toBe(true);
    expect(
      guard.canActivate(
        buildContext({ path: '/doc/abc', headers: {} }),
      ),
    ).toBe(true);
  });

  it('throws UnauthorizedException when API key is missing/invalid', () => {
    process.env.API_KEY = 'secret';
    expect(() =>
      guard.canActivate(
        buildContext({ path: '/users', headers: {} }),
      ),
    ).toThrowError(UnauthorizedException);
    expect(() =>
      guard.canActivate(
        buildContext({
          path: '/users',
          headers: { 'x-api-key': 'wrong' },
        }),
      ),
    ).toThrowError(UnauthorizedException);
  });

  it('grants access when API key matches', () => {
    process.env.API_KEY = 'secret';
    expect(
      guard.canActivate(
        buildContext({
          path: '/users',
          headers: { 'x-api-key': 'secret' },
        }),
      ),
    ).toBe(true);
  });

  it('falls back to URL when path is missing', () => {
    process.env.API_KEY = 'secret';
    expect(
      guard.canActivate(
        buildContext({ url: '/health?q=1', headers: {} }),
      ),
    ).toBe(true);
  });
});
