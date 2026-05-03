import { describe, expect, it } from 'vitest';
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../app-errors';

describe('Custom error classes (unit)', () => {
  it('NotFoundError exposes statusCode 404 and a message', () => {
    const err = new NotFoundError('user not found');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.errorCode).toBe('NotFound');
    expect(err.message).toBe('user not found');
    expect(err.name).toBe('NotFoundError');
  });

  it('ValidationError exposes statusCode 400', () => {
    const err = new ValidationError('payload invalid');
    expect(err.statusCode).toBe(400);
    expect(err.errorCode).toBe('BadRequest');
    expect(err.message).toBe('payload invalid');
  });

  it('UnauthorizedError exposes statusCode 401', () => {
    const err = new UnauthorizedError('login required');
    expect(err.statusCode).toBe(401);
    expect(err.errorCode).toBe('Unauthorized');
  });

  it('ForbiddenError exposes statusCode 403', () => {
    const err = new ForbiddenError('access denied');
    expect(err.statusCode).toBe(403);
    expect(err.errorCode).toBe('Forbidden');
  });

  it('preserves cause via options', () => {
    const cause = new Error('underlying');
    const err = new NotFoundError('wrap', { cause });
    expect((err as Error & { cause?: unknown }).cause).toBe(cause);
  });

  it('thrown errors flow through normal Error checks', () => {
    expect(() => {
      throw new ValidationError('bad');
    }).toThrowError(ValidationError);
    expect(() => {
      throw new ValidationError('bad');
    }).toThrowError(/bad/);
  });
});
