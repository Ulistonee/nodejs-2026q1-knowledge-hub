import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.API_KEY;
    if (!expected) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url?.split('?')[0] ?? '';

    if (path === '/health' || path.startsWith('/doc')) {
      return true;
    }

    const sent = req.headers['x-api-key'];
    if (typeof sent === 'string' && sent === expected) {
      return true;
    }

    throw new UnauthorizedException();
  }
}
