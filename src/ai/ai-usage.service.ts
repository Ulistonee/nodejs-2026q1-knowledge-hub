import { Injectable } from '@nestjs/common';

export interface AiUsageSnapshot {
  totalRequests: number;
  requestsByEndpoint: Record<string, number>;
  totalPromptTokens: number;
  totalCandidatesTokens: number;
  totalTokenCount: number;
  geminiCalls: number;
  totalGeminiLatencyMs: number;
  averageGeminiLatencyMs: number | null;
}

@Injectable()
export class AiUsageService {
  private totalRequests = 0;
  private readonly byEndpoint = new Map<string, number>();
  private totalPromptTokens = 0;
  private totalCandidatesTokens = 0;
  private totalTokenCount = 0;
  private geminiCalls = 0;
  private totalGeminiLatencyMs = 0;

  record(
    endpoint: string,
    usage?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    },
  ): void {
    this.totalRequests += 1;
    this.byEndpoint.set(endpoint, (this.byEndpoint.get(endpoint) ?? 0) + 1);
    if (usage?.promptTokenCount !== undefined) {
      this.totalPromptTokens += usage.promptTokenCount;
    }
    if (usage?.candidatesTokenCount !== undefined) {
      this.totalCandidatesTokens += usage.candidatesTokenCount;
    }
    if (usage?.totalTokenCount !== undefined) {
      this.totalTokenCount += usage.totalTokenCount;
    }
  }

  recordGeminiLatency(latencyMs: number): void {
    this.geminiCalls += 1;
    this.totalGeminiLatencyMs += latencyMs;
  }

  getSnapshot(): AiUsageSnapshot {
    const avg =
      this.geminiCalls > 0
        ? this.totalGeminiLatencyMs / this.geminiCalls
        : null;
    return {
      totalRequests: this.totalRequests,
      requestsByEndpoint: Object.fromEntries(this.byEndpoint),
      totalPromptTokens: this.totalPromptTokens,
      totalCandidatesTokens: this.totalCandidatesTokens,
      totalTokenCount: this.totalTokenCount,
      geminiCalls: this.geminiCalls,
      totalGeminiLatencyMs: this.totalGeminiLatencyMs,
      averageGeminiLatencyMs: avg,
    };
  }
}
