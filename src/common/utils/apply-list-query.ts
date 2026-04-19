import { BadRequestException } from '@nestjs/common';
import { ListQueryDto } from '../dto/list-query.dto';
import { PaginatedResult } from '../interfaces/paginated-result.interface';

function compareValues(a: unknown, b: unknown): number {
  if (a === b) {
    return 0;
  }
  if (a == null) {
    return -1;
  }
  if (b == null) {
    return 1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}

export function applyListQuery<T extends object>(
  items: T[],
  dto: ListQueryDto,
  allowedSortFields: (keyof T)[],
): T[] | PaginatedResult<T> {
  const result = [...items];
  const order = dto.order === 'desc' ? 'desc' : 'asc';

  if (dto.sortBy !== undefined && dto.sortBy !== '') {
    if (!allowedSortFields.includes(dto.sortBy as keyof T)) {
      throw new BadRequestException(`Invalid sortBy: ${dto.sortBy}`);
    }
    const key = dto.sortBy as keyof T;
    result.sort((a, b) => {
      const cmp = compareValues(a[key] as unknown, b[key] as unknown);
      return order === 'asc' ? cmp : -cmp;
    });
  }

  const wantsPagination = dto.page !== undefined || dto.limit !== undefined;

  if (!wantsPagination) {
    return result;
  }

  const page = dto.page ?? 1;
  const limit = dto.limit ?? 10;
  const total = result.length;
  const start = (page - 1) * limit;
  const data = result.slice(start, start + limit);
  return { total, page, limit, data };
}
