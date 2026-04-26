import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { applyListQuery } from '../apply-list-query';

interface Item {
  id: string;
  age: number | null;
}

const items: Item[] = [
  { id: 'b', age: 2 },
  { id: 'a', age: null },
  { id: 'c', age: 1 },
];

describe('applyListQuery', () => {
  it('returns full array when no pagination/sort is given', () => {
    const result = applyListQuery(items, {}, ['id', 'age']);
    expect(Array.isArray(result)).toBe(true);
    expect((result as Item[]).map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('throws BadRequestException for unsupported sortBy', () => {
    expect(() =>
      applyListQuery(items, { sortBy: 'unknown' }, ['id']),
    ).toThrowError(BadRequestException);
  });

  it('sorts ascending by id', () => {
    const result = applyListQuery(items, { sortBy: 'id' }, ['id']) as Item[];
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts descending and treats null as smallest', () => {
    const result = applyListQuery(items, { sortBy: 'age', order: 'desc' }, [
      'age',
    ]) as Item[];
    expect(result.map((i) => i.age)).toEqual([2, 1, null]);
  });

  it('sorts numerics ascending', () => {
    const result = applyListQuery(items, { sortBy: 'age', order: 'asc' }, [
      'age',
    ]) as Item[];
    expect(result.map((i) => i.age)).toEqual([null, 1, 2]);
  });

  it('returns paginated result when page/limit is provided', () => {
    const result = applyListQuery(items, { page: 1, limit: 2 }, ['id']) as {
      total: number;
      page: number;
      limit: number;
      data: Item[];
    };
    expect(result).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(result.data).toHaveLength(2);
  });

  it('handles empty sortBy as no sort', () => {
    const result = applyListQuery(items, { sortBy: '' }, ['id']) as Item[];
    expect(result.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });
});
