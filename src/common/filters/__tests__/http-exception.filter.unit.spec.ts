import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
});
