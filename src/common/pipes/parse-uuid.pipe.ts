import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { validate as isUuid } from 'uuid';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string, _metadata?: ArgumentMetadata): string {
    if (typeof value !== 'string' || !isUuid(value)) {
      throw new BadRequestException(
        'Validation failed (uuid is expected)',
      );
    }
    return value;
  }
}
