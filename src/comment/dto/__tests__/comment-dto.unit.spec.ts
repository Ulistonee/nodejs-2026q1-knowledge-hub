import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCommentDto } from '../create-comment.dto';

const validUuid = '0a35dd62-e09f-444b-a628-f4e7c6954f57';

describe('CreateCommentDto validation', () => {
  it('passes for a valid payload', async () => {
    const dto = plainToInstance(CreateCommentDto, {
      content: 'Hi',
      articleId: validUuid,
      authorId: validUuid,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('passes when authorId is null', async () => {
    const dto = plainToInstance(CreateCommentDto, {
      content: 'Hi',
      articleId: validUuid,
      authorId: null,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when content is empty', async () => {
    const errors = await validate(
      plainToInstance(CreateCommentDto, {
        content: '',
        articleId: validUuid,
      }),
    );
    expect(errors.some((e) => e.property === 'content')).toBe(true);
  });

  it('fails for malformed articleId', async () => {
    const errors = await validate(
      plainToInstance(CreateCommentDto, {
        content: 'Hi',
        articleId: 'not-a-uuid',
      }),
    );
    expect(errors.some((e) => e.property === 'articleId')).toBe(true);
  });

  it('fails for malformed authorId when provided', async () => {
    const errors = await validate(
      plainToInstance(CreateCommentDto, {
        content: 'Hi',
        articleId: validUuid,
        authorId: 'not-a-uuid',
      }),
    );
    expect(errors.some((e) => e.property === 'authorId')).toBe(true);
  });
});
