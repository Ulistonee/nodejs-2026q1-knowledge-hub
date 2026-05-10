import { v5 as uuidv5 } from 'uuid';

const RAG_CHUNK_NAMESPACE = '14c4c8c2-92c4-5646-bbf3-602a8e6e6b71';

export function ragChunkPointId(articleId: string, chunkIndex: number): string {
  return uuidv5(`${articleId}:${chunkIndex}`, RAG_CHUNK_NAMESPACE);
}
