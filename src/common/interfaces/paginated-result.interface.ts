export interface PaginatedResult<T> {
  total: number;
  page: number;
  limit: number;
  data: T[];
}
