import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { RagConfig } from './rag.config';
import { GeminiService } from '../ai/gemini.service';
import { loadGeminiConfig } from '../ai/gemini.config';
import type { GeminiGenerateResult } from '../ai/gemini.types';
import { RAG_CONFIG } from './rag.tokens';

const EMBED_BATCH_SIZE = 16;

interface BatchEmbedRestResponse {
  embeddings?: Array<{ values?: number[] }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

@Injectable()
export class RagGeminiService {
  private readonly gemini = loadGeminiConfig();

  constructor(
    private readonly geminiService: GeminiService,
    @Inject(RAG_CONFIG)
    private readonly rag: RagConfig,
  ) {}

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    if (!this.gemini.apiKey) {
      throw new HttpException(
        'Gemini API is not configured (set GEMINI_API_KEY and restart)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const batches: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += EMBED_BATCH_SIZE) {
      const slice = texts.slice(offset, offset + EMBED_BATCH_SIZE);
      const part = await this.batchEmbed(slice);
      batches.push(...part);
    }

    return batches;
  }

  generateContent(input: {
    systemInstruction?: string;
    userText: string;
  }): Promise<GeminiGenerateResult> {
    return this.geminiService.generateContent(input);
  }

  generateContentMultiTurn(input: {
    systemInstruction?: string;
    contents: Array<{ role: 'user' | 'model'; text: string }>;
  }): Promise<GeminiGenerateResult> {
    return this.geminiService.generateContentMultiTurn(input);
  }

  get embeddingModel(): string {
    return this.gemini.embeddingModel;
  }

  private buildBatchEmbedUrl(): string {
    const base = this.gemini.baseUrl.replace(/\/$/, '');
    const model = encodeURIComponent(this.gemini.embeddingModel);
    const path = `/v1beta/models/${model}:batchEmbedContents`;
    const url = new URL(base + path);
    url.searchParams.set('key', this.gemini.apiKey);
    return url.toString();
  }

  private async batchEmbed(texts: string[]): Promise<number[][]> {
    const modelPath = `models/${this.gemini.embeddingModel}`;
    const outputDim = this.rag.embeddingDimensions;
    const requests = texts.map((t) => {
      const req: Record<string, unknown> = {
        model: modelPath,
        content: { parts: [{ text: t }] },
      };
      if (outputDim >= 1 && outputDim <= 3072) {
        req.outputDimensionality = outputDim;
      }
      return req;
    });
    const payload = JSON.stringify({ requests });

    let response: Response;
    try {
      response = await fetch(this.buildBatchEmbedUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(this.gemini.requestTimeoutMs),
      });
    } catch (cause) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            'Could not reach Gemini embedding API (network or timeout). Check connectivity and GEMINI_API_BASE_URL.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
        { cause },
      );
    }

    const raw = (await response.json()) as BatchEmbedRestResponse;

    if (!response.ok) {
      const upstream = raw.error?.message ?? 'Embedding request failed';
      const authOrBadKey =
        response.status === 401 ||
        response.status === 403 ||
        (response.status === 400 &&
          /\b(api[\s_-]?key|invalid.*key|pass a valid)\b/i.test(upstream));
      if (authOrBadKey) {
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message:
              'Gemini rejected the embedding request: invalid or missing API key (set GEMINI_API_KEY in .env and restart containers).',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (response.status === 429 || response.status >= 500) {
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message:
              response.status === 429
                ? 'Embedding API rate limit or quota exceeded (HTTP 429). Try later or adjust quotas.'
                : 'Embedding API upstream error (5xx). Retry later.',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw new HttpException(upstream, HttpStatus.BAD_GATEWAY);
    }

    const rows = raw.embeddings ?? [];
    if (rows.length !== texts.length) {
      throw new HttpException(
        'Embedding API returned unexpected result size',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return rows.map((row, i) => {
      const v = row.values;
      if (!v?.length) {
        throw new HttpException(
          `Empty embedding at index ${i}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      return v;
    });
  }
}
