import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { RagConfig } from './rag.config';
import { RAG_CONFIG } from './rag.tokens';
import type { VectorSearchHit, VectorUpsertPoint } from './vector-store.client';
import { VectorStoreClient } from './vector-store.client';

interface QdrantSearchResponse {
  result?: Array<{
    id?: string | number;
    score?: number;
    payload?: Record<string, unknown>;
  }>;
  status?: string;
}

interface QdrantScrollResponse {
  status?: string;
  result?: {
    points?: unknown[];
  };
}

@Injectable()
export class QdrantVectorStoreService extends VectorStoreClient {
  constructor(
    @Inject(RAG_CONFIG)
    private readonly rag: RagConfig,
  ) {
    super();
  }

  private baseUrl(path: string): string {
    return `${this.rag.vectorDbUrl}${path}`;
  }

  async ensureCollection(collection: string, vectorSize: number): Promise<void> {
    if (!this.rag.vectorDbUrl) {
      throw new HttpException(
        'Vector database URL is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let head: Response;
    try {
      head = await fetch(
        this.baseUrl(`/collections/${encodeURIComponent(collection)}`),
        { signal: AbortSignal.timeout(15_000) },
      );
    } catch (cause) {
      throw new HttpException(
        'Vector database temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        { cause },
      );
    }

    if (head.ok) {
      return;
    }

    if (head.status !== 404) {
      throw new HttpException(
        `Vector DB error (${head.status})`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let created: Response;
    try {
      created = await fetch(
        this.baseUrl(`/collections/${encodeURIComponent(collection)}`),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vectors: { size: vectorSize, distance: 'Cosine' },
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );
    } catch (cause) {
      throw new HttpException(
        'Vector database temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        { cause },
      );
    }

    if (!created.ok) {
      const text = await created.text().catch(() => '');
      throw new HttpException(
        `Could not create Qdrant collection: ${created.status} ${text.slice(0, 200)}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async upsert(collection: string, points: VectorUpsertPoint[]): Promise<void> {
    if (points.length === 0) {
      return;
    }
    if (!this.rag.vectorDbUrl) {
      throw new HttpException(
        'Vector database URL is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const body = {
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload ?? {},
      })),
    };

    let response: Response;
    try {
      response = await fetch(
        this.baseUrl(
          `/collections/${encodeURIComponent(collection)}/points?wait=true`,
        ),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        },
      );
    } catch (cause) {
      throw new HttpException(
        'Vector database temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        { cause },
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new HttpException(
        `Vector upsert failed: ${response.status} ${text.slice(0, 200)}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async search(
    collection: string,
    vector: number[],
    limit: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchHit[]> {
    if (!this.rag.vectorDbUrl) {
      throw new HttpException(
        'Vector database URL is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const body: Record<string, unknown> = {
      vector,
      limit,
      with_payload: true,
    };

    if (filter && Object.keys(filter).length > 0) {
      body.filter = filter;
    }

    let response: Response;
    try {
      response = await fetch(
        this.baseUrl(
          `/collections/${encodeURIComponent(collection)}/points/search`,
        ),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        },
      );
    } catch (cause) {
      throw new HttpException(
        'Vector database temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        { cause },
      );
    }

    const parsed = (await response.json()) as QdrantSearchResponse;

    if (!response.ok) {
      if (response.status === 404) {
        throw new HttpException(
          `Qdrant has no collection "${collection}". Index articles first with POST /ai/rag/index, or check RAG_VECTOR_DB_URL and RAG_VECTOR_COLLECTION.`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      const detail =
        typeof parsed.status === 'string'
          ? parsed.status
          : `search failed (${response.status})`;
      throw new HttpException(detail, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const rows = parsed.result ?? [];
    return rows.map((row) => ({
      id: String(row.id ?? ''),
      score: row.score ?? 0,
      payload: row.payload,
    }));
  }

  async hasChunksForArticle(
    collection: string,
    articleId: string,
  ): Promise<boolean> {
    if (!this.rag.vectorDbUrl) {
      throw new HttpException(
        'Vector database URL is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let response: Response;
    try {
      response = await fetch(
        this.baseUrl(
          `/collections/${encodeURIComponent(collection)}/points/scroll`,
        ),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filter: {
              must: [
                { key: 'articleId', match: { value: articleId } },
              ],
            },
            limit: 1,
            with_payload: false,
            with_vector: false,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
    } catch (cause) {
      throw new HttpException(
        'Vector database temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        { cause },
      );
    }

    if (response.status === 404) {
      return false;
    }

    const parsed = (await response.json()) as QdrantScrollResponse;

    if (!response.ok) {
      const detail =
        typeof parsed.status === 'string'
          ? parsed.status
          : `scroll failed (${response.status})`;
      throw new HttpException(detail, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const points = parsed.result?.points ?? [];
    return points.length > 0;
  }

  async deleteChunksForArticle(
    collection: string,
    articleId: string,
  ): Promise<void> {
    if (!this.rag.vectorDbUrl) {
      throw new HttpException(
        'Vector database URL is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const body = {
      filter: {
        must: [{ key: 'articleId', match: { value: articleId } }],
      },
    };

    let response: Response;
    try {
      response = await fetch(
        this.baseUrl(
          `/collections/${encodeURIComponent(collection)}/points/delete?wait=true`,
        ),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        },
      );
    } catch (cause) {
      throw new HttpException(
        'Vector database temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        { cause },
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new HttpException(
        `Vector delete failed: ${response.status} ${text.slice(0, 200)}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async deleteChunksForArticleFromChunkIndex(
    collection: string,
    articleId: string,
    fromChunkIndexInclusive: number,
  ): Promise<void> {
    if (!this.rag.vectorDbUrl) {
      throw new HttpException(
        'Vector database URL is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (fromChunkIndexInclusive <= 0) {
      await this.deleteChunksForArticle(collection, articleId);
      return;
    }

    const body = {
      filter: {
        must: [
          { key: 'articleId', match: { value: articleId } },
          { key: 'chunkIndex', range: { gte: fromChunkIndexInclusive } },
        ],
      },
    };

    let response: Response;
    try {
      response = await fetch(
        this.baseUrl(
          `/collections/${encodeURIComponent(collection)}/points/delete?wait=true`,
        ),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        },
      );
    } catch (cause) {
      throw new HttpException(
        'Vector database temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        { cause },
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new HttpException(
        `Vector delete (range) failed: ${response.status} ${text.slice(0, 200)}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
