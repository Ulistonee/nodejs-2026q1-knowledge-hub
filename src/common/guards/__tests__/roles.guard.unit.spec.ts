import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesGuard } from '../roles.guard';

const buildContext = (request: Record<string, unknown>): ExecutionContext => {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

describe('RolesGuard (unit)', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  const originalSecret = process.env.JWT_SECRET_KEY;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
    process.env.JWT_SECRET_KEY = 'unit-test-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET_KEY;
    } else {
      process.env.JWT_SECRET_KEY = originalSecret;
    }
    vi.clearAllMocks();
  });

  it('returns true when JWT secret is not configured', () => {
    delete process.env.JWT_SECRET_KEY;
    expect(guard.canActivate(buildContext({}))).toBe(true);
  });

  it('returns true when no @Roles() metadata is present (defaults to allow)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(buildContext({}))).toBe(true);
  });

  it('throws ForbiddenException when user is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() => guard.canActivate(buildContext({}))).toThrowError(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException for insufficient role', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() =>
      guard.canActivate(buildContext({ user: { role: 'viewer' } })),
    ).toThrowError(ForbiddenException);
  });

  it('grants access when role is included in metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'editor']);
    expect(
      guard.canActivate(buildContext({ user: { role: 'editor' } })),
    ).toBe(true);
  });
});
