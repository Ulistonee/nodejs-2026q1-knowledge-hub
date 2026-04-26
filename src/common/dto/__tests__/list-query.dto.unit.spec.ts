import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ArticleListQueryDto } from '../article-list-query.dto';
import { CommentListQueryDto } from '../comment-list-query.dto';
import { ListQueryDto } from '../list-query.dto';

const validUuid = '0a35dd62-e09f-444b-a628-f4e7c6954f57';

describe('ListQueryDto', () => {
  it('passes for empty input (everything optional)', async () => {
    expect(
      await validate(plainToInstance(ListQueryDto, {})),
    ).toHaveLength(0);
  });

  it('coerces string numbers to integers via @Type', async () => {
    const dto = plainToInstance(ListQueryDto, { page: '2', limit: '5' });
    expect(typeof dto.page).toBe('number');
    expect(typeof dto.limit).toBe('number');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects non-positive page', async () => {
    const errors = await validate(
      plainToInstance(ListQueryDto, { page: 0 }),
    );
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limits beyond the upper bound', async () => {
    const errors = await validate(
      plainToInstance(ListQueryDto, { limit: 999 }),
    );
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects unknown order values', async () => {
    const errors = await validate(
      plainToInstance(ListQueryDto, { order: 'sideways' }),
    );
    expect(errors.some((e) => e.property === 'order')).toBe(true);
  });

  it('treats empty strings for sortBy/order as undefined', async () => {
    const dto = plainToInstance(ListQueryDto, { sortBy: '', order: '' });
    expect(dto.sortBy).toBeUndefined();
    expect(dto.order).toBeUndefined();
  });
});

describe('ArticleListQueryDto', () => {
  it('rejects malformed categoryId UUID', async () => {
    const errors = await validate(
      plainToInstance(ArticleListQueryDto, { categoryId: 'not-uuid' }),
    );
    expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
  });

  it('passes for a valid categoryId and tag', async () => {
    expect(
      await validate(
        plainToInstance(ArticleListQueryDto, {
          categoryId: validUuid,
          tag: 'nest',
          status: 'draft',
        }),
      ),
    ).toHaveLength(0);
  });

  it('treats empty strings as undefined', async () => {
    const dto = plainToInstance(ArticleListQueryDto, {
      status: '',
      categoryId: '',
      tag: '',
    });
    expect(dto.status).toBeUndefined();
    expect(dto.categoryId).toBeUndefined();
    expect(dto.tag).toBeUndefined();
  });
});

describe('CommentListQueryDto', () => {
  it('requires a valid articleId', async () => {
    const dto = plainToInstance(CommentListQueryDto, { articleId: 'no' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'articleId')).toBe(true);
  });

  it('passes for valid articleId', async () => {
    expect(
      await validate(
        plainToInstance(CommentListQueryDto, { articleId: validUuid }),
      ),
    ).toHaveLength(0);
  });
});
