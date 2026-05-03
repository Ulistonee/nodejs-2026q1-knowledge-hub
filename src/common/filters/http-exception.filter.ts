import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../errors/app-errors';
import { redactString } from '../logger/redact';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
}

interface MappedError {
  status: number;
  error: string;
  message: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const mapped = this.map(exception);

    const body: ErrorResponseBody = {
      statusCode: mapped.status,
      error: mapped.error,
      message: mapped.message,
      path: request?.url ?? '',
      timestamp: new Date().toISOString(),
    };

    this.applyRetryAfterHeader(exception, response);

    this.logException(exception, request, body);

    response.status(mapped.status).json(body);
  }

  private map(exception: unknown): MappedError {
    if (exception instanceof AppError) {
      return {
        status: exception.statusCode,
        error: exception.errorCode,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      let message = exception.message;
      let error = exception.name;

      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const obj = res as Record<string, unknown>;
        if (typeof obj.message === 'string') {
          message = obj.message;
        } else if (Array.isArray(obj.message)) {
          message = obj.message.join('; ');
        }
        if (typeof obj.error === 'string') {
          error = obj.error;
        }
      }

      return { status, error, message };
    }

    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: exception.name || 'Error',
        message: exception.message || 'An unexpected error occurred',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      message: 'Internal server error',
    };
  }

  private applyRetryAfterHeader(exception: unknown, response: Response): void {
    if (!(exception instanceof HttpException)) {
      return;
    }
    const res = exception.getResponse();
    if (!res || typeof res !== 'object') {
      return;
    }
    const retryAfter = (res as { retryAfter?: unknown }).retryAfter;
    if (typeof retryAfter === 'number' && retryAfter >= 0) {
      response.setHeader('Retry-After', String(Math.ceil(retryAfter)));
    }
  }

  private logException(
    exception: unknown,
    request: Request | undefined,
    body: ErrorResponseBody,
  ): void {
    const method = request?.method ?? '';
    const path = body.path;
    const summary = `${method} ${path} -> ${body.statusCode} ${body.message}`;
    const trace =
      exception instanceof Error && exception.stack
        ? redactString(exception.stack)
        : undefined;

    if (body.statusCode >= 500) {
      this.logger.error(summary, trace);
    } else if (body.statusCode >= 400) {
      this.logger.warn(summary);
    } else {
      this.logger.debug?.(summary);
    }
  }
}
