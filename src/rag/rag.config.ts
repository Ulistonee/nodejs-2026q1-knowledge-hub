export type RagVectorDbProvider = 'qdrant';

export interface RagConfig {
  vectorDbProvider: RagVectorDbProvider;
  vectorDbUrl: string;
  vectorCollection: string;
  chunkSize: number;
  chunkOverlap: number;
  conversationMaxMessages: number;
  embeddingDimensions: number;
}

const DEFAULT_EMBEDDING_DIM = 768;

export function loadRagConfig(): RagConfig {
  const raw = (process.env.RAG_VECTOR_DB_PROVIDER ?? 'qdrant').toLowerCase();
  if (raw !== 'qdrant') {
    throw new Error(
      `Unsupported RAG_VECTOR_DB_PROVIDER="${raw}". Only "qdrant" is implemented.`,
    );
  }

  return {
    vectorDbProvider: 'qdrant',
    vectorDbUrl: (process.env.RAG_VECTOR_DB_URL ?? '').replace(/\/$/, ''),
    vectorCollection:
      process.env.RAG_VECTOR_COLLECTION ?? 'knowledge_hub_articles',
    chunkSize: Math.max(1, Number(process.env.RAG_CHUNK_SIZE ?? 800)),
    chunkOverlap: Math.max(
      0,
      Number(process.env.RAG_CHUNK_OVERLAP ?? 200),
    ),
    conversationMaxMessages: Math.max(
      1,
      Number(process.env.RAG_CONVERSATION_MAX_MESSAGES ?? 20),
    ),
    embeddingDimensions: Math.max(
      1,
      Number(process.env.RAG_EMBEDDING_DIMENSION ?? DEFAULT_EMBEDDING_DIM),
    ),
  };
}
