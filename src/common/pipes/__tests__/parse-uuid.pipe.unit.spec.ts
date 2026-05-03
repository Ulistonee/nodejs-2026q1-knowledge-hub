import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ParseUuidPipe } from '../parse-uuid.pipe';

describe('ParseUuidPipe (unit)', () => {
  const pipe = new ParseUuidPipe();
  const validUuid = '0a35dd62-e09f-444b-a628-f4e7c6954f57';

  it('passes a valid UUID through unchanged', () => {
    expect(pipe.transform(validUuid)).toBe(validUuid);
  });

  it('throws BadRequestException for an invalid string', () => {
    expect(() => pipe.transform('not-a-uuid')).toThrowError(
      BadRequestException,
    );
  });

  it('throws BadRequestException for empty input', () => {
    expect(() => pipe.transform('')).toThrowError(BadRequestException);
  });

  it('throws BadRequestException for non-string input', () => {
    expect(() =>
      pipe.transform(undefined as unknown as string),
    ).toThrowError(BadRequestException);
    expect(() =>
      pipe.transform(123 as unknown as string),
    ).toThrowError(BadRequestException);
  });
});
