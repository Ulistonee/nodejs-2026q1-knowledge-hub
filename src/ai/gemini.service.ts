import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
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
  private readonly logger = new Logger(GeminiService.name);
  private readonly config: GeminiConfig;

  constructor() {
    this.config = loadGeminiConfig();
  }

  async generateContent(input: {
    systemInstruction?: string;
    userText: string;
  }): Promise<GeminiGenerateResult> {
    return this.generateContentMultiTurn({
      systemInstruction: input.systemInstruction,
      contents: [{ role: 'user', text: input.userText }],
    });
  }

  async generateContentMultiTurn(input: {
    systemInstruction?: string;
    contents: Array<{ role: 'user' | 'model'; text: string }>;
  }): Promise<GeminiGenerateResult> {
    if (!this.config.apiKey) {
      throw new HttpException(
        'Gemini API is not configured (set GEMINI_API_KEY and restart)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const body = this.buildRequestBody(
      input.systemInstruction,
      input.contents,
    );
    return this.executeGenerate(body);
  }

  private buildRequestBody(
    systemInstruction: string | undefined,
    contents: Array<{ role: 'user' | 'model'; text: string }>,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      contents: contents.map((c) => ({
        role: c.role,
        parts: [{ text: c.text }],
      })),
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    return body;
  }

  private async executeGenerate(
    body: Record<string, unknown>,
  ): Promise<GeminiGenerateResult> {
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
        const detail =
          cause instanceof Error ? cause.message : String(cause);
        this.logger.warn(`Gemini generateContent: fetch failed (${detail})`);
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message:
              'Could not reach Gemini API (network timeout or DNS). Check GEMINI_API_BASE_URL and connectivity.',
          },
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
        this.logGeminiUpstreamError(
          'generateContent',
          response.status,
          raw,
        );
        this.logger.warn(
          'Gemini generateContent: empty text (check blockReason / candidates in response)',
        );
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

    this.logger.warn(
      `Gemini generateContent: exhausted retries (${MAX_UPSTREAM_RETRIES + 1} attempts); often upstream 429`,
    );
    throw new HttpException(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          'Gemini still returned errors after retries (often HTTP 429). Check quotas in Google AI Studio or wait and retry.',
      },
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

  private logGeminiUpstreamError(
    phase: string,
    httpStatus: number,
    raw: GeminiRestResponse,
  ): void {
    const err = raw.error;
    const parts: string[] = [`httpStatus=${httpStatus}`];
    if (err?.status !== undefined) {
      parts.push(`api.status=${String(err.status)}`);
    }
    if (err?.code !== undefined) {
      parts.push(`api.code=${String(err.code)}`);
    }
    if (err?.message) {
      parts.push(`api.message=${err.message.slice(0, 500)}`);
    }
    this.logger.warn(`Gemini ${phase}: ${parts.join(' ')}`);
  }

  private throwFromGeminiError(
    httpStatus: number,
    raw: GeminiRestResponse,
  ): never {
    this.logGeminiUpstreamError('generateContent', httpStatus, raw);
    const err = raw.error;
    const upstreamMsg = err?.message ?? 'Gemini request failed';

    if (httpStatus === 401 || httpStatus === 403) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            `Gemini rejected the request (HTTP ${httpStatus}). Verify GEMINI_API_KEY and model access.`,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (httpStatus === 429) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            'Gemini rate limit or quota exceeded (HTTP 429). Check usage in Google AI Studio, billing, or try later.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (httpStatus >= 500) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            'Gemini returned an upstream server error (5xx). Retry later; outage may be transient.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    throw new HttpException(upstreamMsg, HttpStatus.BAD_GATEWAY);
  }
}
