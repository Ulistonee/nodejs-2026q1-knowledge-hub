import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../errors/app-errors';
import { AllExceptionsFilter } from '../http-exception.filter';

describe('AllExceptionsFilter (unit)', () => {
  let filter: AllExceptionsFilter;
  let json: ReturnType<typeof vi.fn>;
  let status: ReturnType<typeof vi.fn>;
  let host: ArgumentsHost;

  const buildHost = (
    request: Record<string, unknown> = { method: 'GET', url: '/x' },
  ): ArgumentsHost => {
    json = vi.fn();
    status = vi.fn().mockReturnValue({ json });
    return {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;
  };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    host = buildHost();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('formats NotFoundException with the correct status', () => {
    filter.catch(new NotFoundException('missing'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'missing',
        path: '/x',
        error: expect.any(String),
      }),
    );
  });

  it('flattens validation messages from BadRequestException', () => {
    const ex = new BadRequestException({
      statusCode: 400,
      message: ['login must be a string', 'password should not be empty'],
      error: 'Bad Request',
    });

    filter.catch(ex, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'login must be a string; password should not be empty',
        error: 'Bad Request',
      }),
    );
  });

  it('handles HttpException with string response body', () => {
    filter.catch(new HttpException('teapot', 418), host);

    expect(status).toHaveBeenCalledWith(418);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'teapot' }),
    );
  });

  it('falls back to 500 for unknown errors', () => {
    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'boom',
        error: 'Error',
      }),
    );
  });

  it('produces a generic body for non-Error throwables', () => {
    filter.catch('something weird', host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'InternalServerError',
      }),
    );
  });

  describe('custom AppError mapping', () => {
    it('maps NotFoundError to 404', () => {
      filter.catch(new NotFoundError('article missing'), host);
      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          error: 'NotFound',
          message: 'article missing',
        }),
      );
    });

    it('maps ValidationError to 400', () => {
      filter.catch(new ValidationError('bad payload'), host);
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          error: 'BadRequest',
          message: 'bad payload',
        }),
      );
    });

    it('maps UnauthorizedError to 401', () => {
      filter.catch(new UnauthorizedError('login required'), host);
      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          error: 'Unauthorized',
        }),
      );
    });

    it('maps ForbiddenError to 403', () => {
      filter.catch(new ForbiddenError('not allowed'), host);
      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          error: 'Forbidden',
        }),
      );
    });
  });

  it('logs at error level with stack trace for 5xx responses', () => {
    const errorSpy = vi.spyOn(Logger.prototype, 'error');
    const ex = new Error('boom');
    filter.catch(ex, host);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const args = errorSpy.mock.calls[0];
    expect(args[0]).toContain('GET /x -> 500 boom');
    expect(args[1]).toEqual(expect.stringContaining('Error: boom'));
  });

  it('logs at warn level for 4xx responses', () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn');
    filter.catch(new NotFoundError('absent'), host);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
