export interface GeminiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  embeddingModel: string;
  requestTimeoutMs: number;
  aiCacheTtlSec: number;
  aiRateLimitRpm: number;
  aiConversationTtlSec: number;
  aiConversationMaxMessages: number;
}

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_TIMEOUT_MS = 60_000;

export function loadGeminiConfig(): GeminiConfig {
  const rawKey = process.env.GEMINI_API_KEY ?? '';

  return {
    apiKey: rawKey.trim(),
    baseUrl: process.env.GEMINI_API_BASE_URL ?? DEFAULT_BASE_URL,
    model: process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
    embeddingModel:
      process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
    requestTimeoutMs: DEFAULT_TIMEOUT_MS,
    aiCacheTtlSec: Math.max(0, Number(process.env.AI_CACHE_TTL_SEC ?? 300)),
    aiRateLimitRpm: Math.max(1, Number(process.env.AI_RATE_LIMIT_RPM ?? 20)),
    aiConversationTtlSec: Math.max(
      60,
      Number(process.env.AI_CONVERSATION_TTL_SEC ?? 1800),
    ),
    aiConversationMaxMessages: Math.max(
      2,
      Number(process.env.AI_CONVERSATION_MAX_MESSAGES ?? 24),
    ),
  };
}
