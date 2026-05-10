import { Inject, Injectable } from '@nestjs/common';
import type { RagConfig } from './rag.config';
import { chunkTextDeterministic } from './chunk-text';
import { RAG_CONFIG } from './rag.tokens';

@Injectable()
export class RagChunkingService {
  constructor(
    @Inject(RAG_CONFIG)
    private readonly rag: RagConfig,
  ) {}

  chunkArticleText(text: string): string[] {
    return chunkTextDeterministic(
      text,
      this.rag.chunkSize,
      this.rag.chunkOverlap,
    );
  }
}
