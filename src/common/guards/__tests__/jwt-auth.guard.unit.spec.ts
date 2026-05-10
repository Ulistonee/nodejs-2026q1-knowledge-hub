import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../jwt-auth.guard';

const buildContext = (
  request: Record<string, unknown> = {},
): ExecutionContext => {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

describe('JwtAuthGuard (unit)', () => {
  let guard: JwtAuthGuard;
  let jwt: { verifyAsync: ReturnType<typeof vi.fn> };
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  const originalSecret = process.env.JWT_SECRET_KEY;

  beforeEach(() => {
    jwt = { verifyAsync: vi.fn() };
    reflector = { getAllAndOverride: vi.fn() };
    guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      reflector as unknown as Reflector,
    );
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

  it('allows public routes without verifying tokens', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const ctx = buildContext({ headers: {} });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('bypasses validation when JWT secret is not configured', async () => {
    delete process.env.JWT_SECRET_KEY;
    reflector.getAllAndOverride.mockReturnValue(false);

    await expect(guard.canActivate(buildContext({}))).resolves.toBe(true);
  });

  it('throws UnauthorizedException when no token provided', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const ctx = buildContext({ headers: {} });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException for non-Bearer schemes', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const ctx = buildContext({ headers: { authorization: 'Basic xxx' } });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException for malformed/expired tokens', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwt.verifyAsync.mockRejectedValue(new Error('jwt malformed'));
    const ctx = buildContext({
      headers: { authorization: 'Bearer broken' },
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the decoded payload to the request and returns true', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwt.verifyAsync.mockResolvedValue({ userId: 'u1', role: 'admin' });

    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer good-token' },
    };
    const ctx = buildContext(request);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('good-token', {
      secret: 'unit-test-secret',
    });
    expect(request['user']).toEqual({ userId: 'u1', role: 'admin' });
  });
});
