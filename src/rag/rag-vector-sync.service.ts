import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RagConfig } from './rag.config';
import { RAG_CONFIG } from './rag.tokens';
import { VectorStoreClient } from './vector-store.client';

@Injectable()
export class RagVectorSyncService {
  private readonly logger = new Logger(RagVectorSyncService.name);

  constructor(
    @Inject(RAG_CONFIG)
    private readonly rag: RagConfig,
    private readonly vector: VectorStoreClient,
  ) {}

  async removeArticleVectorsSafe(articleId: string): Promise<void> {
    if (!this.rag.vectorDbUrl?.length) {
      return;
    }
    try {
      await this.vector.deleteChunksForArticle(
        this.rag.vectorCollection,
        articleId,
      );
    } catch (e) {
      this.logger.warn(
        `Could not drop RAG vectors for article ${articleId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}
