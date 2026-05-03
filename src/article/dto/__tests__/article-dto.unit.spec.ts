import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ArticleStatus } from '../../enums/article-status.enum';
import { CreateArticleDto } from '../create-article.dto';
import { UpdateArticleDto } from '../update-article.dto';

const validUuid = '0a35dd62-e09f-444b-a628-f4e7c6954f57';

describe('CreateArticleDto validation', () => {
  it('passes for a valid payload', async () => {
    const dto = plainToInstance(CreateArticleDto, {
      title: 'A',
      content: 'B',
      status: ArticleStatus.PUBLISHED,
      categoryId: validUuid,
      tags: ['x'],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when required title and content are missing', async () => {
    const dto = plainToInstance(CreateArticleDto, {});
    const errors = await validate(dto);
    const props = errors.map((e) => e.property);
    expect(props).toEqual(expect.arrayContaining(['title', 'content']));
  });

  it('fails for invalid status enum', async () => {
    const dto = plainToInstance(CreateArticleDto, {
      title: 'A',
      content: 'B',
      status: 'unknown-status',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('fails for malformed UUID in authorId', async () => {
    const dto = plainToInstance(CreateArticleDto, {
      title: 'A',
      content: 'B',
      authorId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'authorId')).toBe(true);
  });

  it('fails when tags is not an array of strings', async () => {
    const dto = plainToInstance(CreateArticleDto, {
      title: 'A',
      content: 'B',
      tags: [1, 2, 3],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tags')).toBe(true);
  });
});

describe('UpdateArticleDto validation (PartialType)', () => {
  it('passes for empty payload', async () => {
    const dto = plainToInstance(UpdateArticleDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('still validates types when fields provided', async () => {
    const dto = plainToInstance(UpdateArticleDto, {
      status: 'invalid-status',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
