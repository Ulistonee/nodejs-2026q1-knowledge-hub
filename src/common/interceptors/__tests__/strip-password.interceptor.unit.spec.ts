import { ExecutionContext, CallHandler } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { StripPasswordInterceptor } from '../strip-password.interceptor';

const ctx = {} as ExecutionContext;

const buildHandler = <T>(value: T): CallHandler => ({
  handle: () => of(value),
});

describe('StripPasswordInterceptor (unit)', () => {
  const interceptor = new StripPasswordInterceptor();

  it('removes password from a single object', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(
        ctx,
        buildHandler({ id: '1', login: 'a', password: 'secret' }),
      ),
    );

    expect(result).toEqual({ id: '1', login: 'a' });
    expect(result).not.toHaveProperty('password');
  });

  it('removes password from each item in an array', async () => {
    const result = (await lastValueFrom(
      interceptor.intercept(
        ctx,
        buildHandler([
          { id: '1', password: 'a' },
          { id: '2', password: 'b' },
        ]),
      ),
    )) as Array<Record<string, unknown>>;

    expect(result[0]).not.toHaveProperty('password');
    expect(result[1]).not.toHaveProperty('password');
  });

  it('removes password inside paginated result data', async () => {
    const result = (await lastValueFrom(
      interceptor.intercept(
        ctx,
        buildHandler({
          total: 1,
          page: 1,
          limit: 10,
          data: [{ id: '1', password: 'p' }],
        }),
      ),
    )) as { data: Array<Record<string, unknown>> };

    expect(result.data[0]).not.toHaveProperty('password');
  });

  it('passes through values without password', async () => {
    const value = { id: '1', login: 'a' };
    await expect(
      lastValueFrom(interceptor.intercept(ctx, buildHandler(value))),
    ).resolves.toEqual(value);
  });

  it('handles null and undefined gracefully', async () => {
    await expect(
      lastValueFrom(interceptor.intercept(ctx, buildHandler(null))),
    ).resolves.toBeNull();
    await expect(
      lastValueFrom(interceptor.intercept(ctx, buildHandler(undefined))),
    ).resolves.toBeUndefined();
  });

  it('passes through primitives unchanged', async () => {
    await expect(
      lastValueFrom(interceptor.intercept(ctx, buildHandler('hello'))),
    ).resolves.toBe('hello');
    await expect(
      lastValueFrom(interceptor.intercept(ctx, buildHandler(42))),
    ).resolves.toBe(42);
  });
});
