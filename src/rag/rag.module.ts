import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { RagChatStoreService } from './rag-chat-store.service';
import { RagChunkingService } from './rag-chunking.service';
import { RagGeminiService } from './rag-gemini.service';
import { RagHybridRetrievalService } from './rag-hybrid-retrieval.service';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RagVectorSyncService } from './rag-vector-sync.service';
import { loadRagConfig } from './rag.config';
import { QdrantVectorStoreService } from './qdrant-vector-store.service';
import { RAG_CONFIG } from './rag.tokens';
import { VectorStoreClient } from './vector-store.client';

@Module({
  imports: [forwardRef(() => AiModule)],
  controllers: [RagController],
  providers: [
    RagChunkingService,
    RagGeminiService,
    RagHybridRetrievalService,
    RagChatStoreService,
    RagVectorSyncService,
    RagService,
    QdrantVectorStoreService,
    { provide: RAG_CONFIG, useFactory: () => loadRagConfig() },
    { provide: VectorStoreClient, useExisting: QdrantVectorStoreService },
  ],
  exports: [
    RagChunkingService,
    RagGeminiService,
    RagVectorSyncService,
    VectorStoreClient,
    RAG_CONFIG,
    RagService,
  ],
})
export class RagModule {}
