export interface GeminiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  requestTimeoutMs: number;
  aiCacheTtlSec: number;
  aiRateLimitRpm: number;
}

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_TIMEOUT_MS = 60_000;

export function loadGeminiConfig(): GeminiConfig {
  return {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    baseUrl: process.env.GEMINI_API_BASE_URL ?? DEFAULT_BASE_URL,
    model: process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
    requestTimeoutMs: DEFAULT_TIMEOUT_MS,
    aiCacheTtlSec: Math.max(0, Number(process.env.AI_CACHE_TTL_SEC ?? 300)),
    aiRateLimitRpm: Math.max(1, Number(process.env.AI_RATE_LIMIT_RPM ?? 20)),
  };
}
