import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { loadGeminiConfig, type GeminiConfig } from './gemini.config';
import type { GeminiGenerateResult } from './gemini.types';

interface GeminiRestCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

interface GeminiRestResponse {
  candidates?: GeminiRestCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const MAX_UPSTREAM_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class GeminiService {
  private readonly config: GeminiConfig;

  constructor() {
    this.config = loadGeminiConfig();
  }

  async generateContent(input: {
    systemInstruction?: string;
    userText: string;
  }): Promise<GeminiGenerateResult> {
    if (!this.config.apiKey) {
      throw new HttpException(
        'Gemini API is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: input.userText }],
        },
      ],
    };

    if (input.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: input.systemInstruction }],
      };
    }

    const payload = JSON.stringify(body);
    for (let attempt = 0; attempt <= MAX_UPSTREAM_RETRIES; attempt++) {
      let response: Response;
      try {
        response = await fetch(this.buildGenerateContentUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });
      } catch (cause) {
        throw new HttpException(
          'AI service temporarily unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
          { cause },
        );
      }

      const raw = (await response.json()) as GeminiRestResponse;

      if (response.status === 429 && attempt < MAX_UPSTREAM_RETRIES) {
        await sleep(500 * 2 ** attempt);
        continue;
      }

      if (!response.ok) {
        this.throwFromGeminiError(response.status, raw);
      }

      const text = this.extractText(raw);
      if (text === '') {
        throw new HttpException(
          'AI returned an empty response',
          HttpStatus.BAD_GATEWAY,
        );
      }

      const usage = raw.usageMetadata
        ? {
            promptTokenCount: raw.usageMetadata.promptTokenCount,
            candidatesTokenCount: raw.usageMetadata.candidatesTokenCount,
            totalTokenCount: raw.usageMetadata.totalTokenCount,
          }
        : undefined;

      return { text, usage };
    }

    throw new HttpException(
      'AI service temporarily unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private buildGenerateContentUrl(): string {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const path = `/v1beta/models/${this.config.model}:generateContent`;
    const url = new URL(base + path);
    url.searchParams.set('key', this.config.apiKey);
    return url.toString();
  }

  private extractText(parsed: GeminiRestResponse): string {
    const parts = parsed.candidates?.[0]?.content?.parts;
    if (!parts?.length) {
      return '';
    }
    return parts.map((p) => p.text ?? '').join('');
  }

  private throwFromGeminiError(
    httpStatus: number,
    raw: GeminiRestResponse,
  ): never {
    const err = raw.error;
    const upstreamMsg = err?.message ?? 'Gemini request failed';

    if (httpStatus === 401 || httpStatus === 403) {
      throw new HttpException(
        'AI service configuration error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (httpStatus === 429) {
      throw new HttpException(
        'AI service temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (httpStatus >= 500) {
      throw new HttpException(
        'AI service temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    throw new HttpException(upstreamMsg, HttpStatus.BAD_GATEWAY);
  }
}
