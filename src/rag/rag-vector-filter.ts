import type { VectorSearchFilter } from './vector-store.client';

export interface RagVectorFilterInput {
  status?: string;
  categoryId?: string;
  tags?: string[];
}

export function buildQdrantMetadataFilter(
  params: RagVectorFilterInput,
): VectorSearchFilter | undefined {
  const must: Array<Record<string, unknown>> = [];

  if (params.status?.trim()) {
    must.push({
      key: 'status',
      match: { value: params.status.trim() },
    });
  }

  if (params.categoryId?.trim()) {
    must.push({
      key: 'categoryId',
      match: { value: params.categoryId.trim() },
    });
  }

  for (const t of params.tags ?? []) {
    const tag = typeof t === 'string' ? t.trim() : '';
    if (!tag) {
      continue;
    }
    must.push({
      key: 'tags',
      match: { value: tag },
    });
  }

  if (must.length === 0) {
    return undefined;
  }

  return { must };
}
