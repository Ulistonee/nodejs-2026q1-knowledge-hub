import { HttpException, HttpStatus } from '@nestjs/common';

export class AiRateLimitException extends HttpException {
  constructor(retryAfterSeconds: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Too many AI requests. Try again later.',
        retryAfter: retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
