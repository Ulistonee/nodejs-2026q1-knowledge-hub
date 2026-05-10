import { Injectable } from '@nestjs/common';

export interface VectorUpsertPoint {
  id: string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface VectorSearchHit {
  id: string;
  score: number;
  payload?: Record<string, unknown>;
}

export type VectorSearchFilter = Record<string, unknown>;

@Injectable()
export abstract class VectorStoreClient {
  abstract upsert(
    collection: string,
    points: VectorUpsertPoint[],
  ): Promise<void>;

  abstract search(
    collection: string,
    vector: number[],
    limit: number,
    filter?: VectorSearchFilter,
  ): Promise<VectorSearchHit[]>;

  abstract ensureCollection(
    collection: string,
    vectorSize: number,
  ): Promise<void>;

  abstract hasChunksForArticle(
    collection: string,
    articleId: string,
  ): Promise<boolean>;

  abstract deleteChunksForArticle(
    collection: string,
    articleId: string,
  ): Promise<void>;

  abstract deleteChunksForArticleFromChunkIndex(
    collection: string,
    articleId: string,
    fromChunkIndexInclusive: number,
  ): Promise<void>;
}
