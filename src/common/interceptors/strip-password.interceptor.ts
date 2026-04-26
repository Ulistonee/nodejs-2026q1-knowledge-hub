import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type Maybe<T> = T | null | undefined;

function stripPassword<T>(value: Maybe<T>): Maybe<T> {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripPassword(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('data' in obj && Array.isArray(obj.data)) {
      return {
        ...obj,
        data: obj.data.map((item) => stripPassword(item)),
      } as unknown as T;
    }
    if ('password' in obj) {
      const { password, ...rest } = obj;
      void password;
      return rest as unknown as T;
    }
  }
  return value;
}

@Injectable()
export class StripPasswordInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => stripPassword(data)));
  }
}
