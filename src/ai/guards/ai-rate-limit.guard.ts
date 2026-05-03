import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AiRateLimitException } from '../exceptions/rate-limit.exception';
import { loadGeminiConfig } from '../gemini.config';

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly windowMs = 60_000;
  private readonly limit: number;
  private readonly timestampsByClient = new Map<string, number[]>();

  constructor() {
    this.limit = loadGeminiConfig().aiRateLimitRpm;
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const clientKey = this.resolveClientKey(req);
    const now = Date.now();

    let stamps = this.timestampsByClient.get(clientKey) ?? [];
    stamps = stamps.filter((t) => now - t < this.windowMs);

    if (stamps.length >= this.limit) {
      const oldest = stamps[0]!;
      const retryAfterSec = Math.max(
        1,
        Math.ceil((this.windowMs - (now - oldest)) / 1000),
      );
      throw new AiRateLimitException(retryAfterSec);
    }

    stamps.push(now);
    this.timestampsByClient.set(clientKey, stamps);
    return true;
  }

  private resolveClientKey(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]!.trim();
    }
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  }
}
