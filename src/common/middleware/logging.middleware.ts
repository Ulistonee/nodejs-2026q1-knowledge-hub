import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { redactSensitive } from '../logger/redact';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const safeQuery = redactSensitive(req.query);
    const safeBody = redactSensitive(req.body);

    const reqPayload: Record<string, unknown> = {
      method: req.method,
      url: req.originalUrl,
      query: safeQuery,
    };

    if (req.body && Object.keys(req.body as object).length > 0) {
      reqPayload.body = safeBody;
    }

    this.logger.log(`request ${formatPayload(reqPayload)}`);

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const resPayload = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
      };
      const message = `response ${formatPayload(resPayload)}`;
      if (res.statusCode >= 500) {
        this.logger.error(message);
      } else if (res.statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}

function formatPayload(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return '[unserializable payload]';
  }
}
