import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { ArticleService } from '../article/article.service';
import { AiCacheService } from './ai-cache.service';
import { AiUsageService } from './ai-usage.service';
import { AnalyzeArticleDto } from './dto/analyze-article.dto';
import { GenerateAiDto } from './dto/generate-ai.dto';
import { SummarizeArticleDto } from './dto/summarize-article.dto';
import { TranslateArticleDto } from './dto/translate-article.dto';
import { GeminiService } from './gemini.service';
import type { AnalyzeArticleResponse } from './interfaces/analyze-article-response';
import type { SummarizeArticleResponse } from './interfaces/summarize-article-response';
import type { TranslateArticleResponse } from './interfaces/translate-article-response';
import {
  buildAnalyzeArticlePrompt,
  buildFreeformGeneratePrompt,
  buildSummarizeArticlePrompt,
  buildTranslateArticlePrompt,
} from './prompts';
import type { GeminiGenerateResult } from './gemini.types';
import { parseModelJsonObject } from './utils/parse-model-json';

const USAGE_SUMMARIZE = 'summarize';
const USAGE_TRANSLATE = 'translate';
const USAGE_ANALYZE = 'analyze';
const USAGE_GENERATE = 'generate';

@Injectable()
export class AiService {
  constructor(
    private readonly articleService: ArticleService,
    private readonly geminiService: GeminiService,
    private readonly cache: AiCacheService,
    private readonly usage: AiUsageService,
  ) {}

  /** Snapshot for `GET /ai/usage` (admin): tokens, RPM counters, cache ratio, Gemini latency. */
  getDiagnostics(): {
    usage: ReturnType<AiUsageService['getSnapshot']>;
    cache: ReturnType<AiCacheService['getStats']>;
  } {
    return {
      usage: this.usage.getSnapshot(),
      cache: this.cache.getStats(),
    };
  }

  private async invokeGemini(input: {
    systemInstruction?: string;
    userText: string;
  }): Promise<GeminiGenerateResult> {
    const t0 = performance.now();
    try {
      return await this.geminiService.generateContent(input);
    } finally {
      this.usage.recordGeminiLatency(performance.now() - t0);
    }
  }

  async summarizeArticle(
    articleId: string,
    dto: SummarizeArticleDto,
  ): Promise<SummarizeArticleResponse> {
    const article = await this.articleService.findOne(articleId);
    const maxLength = dto.maxLength ?? 'medium';

    const cacheKey = this.cache.cacheKeyParts([
      'summarize',
      articleId,
      maxLength,
      String(article.updatedAt),
    ]);

    const cached = this.cache.get<SummarizeArticleResponse>(cacheKey);
    if (cached) {
      this.usage.record(USAGE_SUMMARIZE);
      return cached;
    }

    const { systemInstruction, userText } = buildSummarizeArticlePrompt(
      { title: article.title, content: article.content },
      maxLength,
    );

    const { text, usage } = await this.invokeGemini({
      systemInstruction,
      userText,
    });

    const summary = text.trim();
    const body: SummarizeArticleResponse = {
      articleId,
      summary,
      originalLength: article.content.length,
      summaryLength: summary.length,
    };

    this.cache.set(cacheKey, body);
    this.usage.record(USAGE_SUMMARIZE, usage);
    return body;
  }

  async translateArticle(
    articleId: string,
    dto: TranslateArticleDto,
  ): Promise<TranslateArticleResponse> {
    const article = await this.articleService.findOne(articleId);

    const cacheKey = this.cache.cacheKeyParts([
      'translate',
      articleId,
      dto.targetLanguage,
      dto.sourceLanguage ?? '',
      String(article.updatedAt),
    ]);

    const cached = this.cache.get<TranslateArticleResponse>(cacheKey);
    if (cached) {
      this.usage.record(USAGE_TRANSLATE);
      return cached;
    }

    const { systemInstruction, userText } = buildTranslateArticlePrompt({
      article: { title: article.title, content: article.content },
      targetLanguage: dto.targetLanguage,
      sourceLanguage: dto.sourceLanguage,
    });

    const { text, usage } = await this.invokeGemini({
      systemInstruction,
      userText,
    });

    const obj = parseModelJsonObject(text);
    const translatedText =
      typeof obj.translatedText === 'string' ? obj.translatedText.trim() : '';
    const detectedLanguage =
      typeof obj.detectedLanguage === 'string'
        ? obj.detectedLanguage.trim()
        : 'unknown';

    if (!translatedText) {
      throw new HttpException(
        'AI returned empty translation',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const body: TranslateArticleResponse = {
      articleId,
      translatedText,
      detectedLanguage,
    };

    this.cache.set(cacheKey, body);
    this.usage.record(USAGE_TRANSLATE, usage);
    return body;
  }

  async analyzeArticle(
    articleId: string,
    dto: AnalyzeArticleDto,
  ): Promise<AnalyzeArticleResponse> {
    const article = await this.articleService.findOne(articleId);
    const task = dto.task ?? 'review';

    const { systemInstruction, userText } = buildAnalyzeArticlePrompt(
      { title: article.title, content: article.content },
      task,
    );

    const { text, usage } = await this.invokeGemini({
      systemInstruction,
      userText,
    });

    const obj = parseModelJsonObject(text);
    const analysis =
      typeof obj.analysis === 'string' ? obj.analysis.trim() : '';

    let suggestions: string[] = [];
    if (Array.isArray(obj.suggestions)) {
      suggestions = obj.suggestions.filter(
        (s): s is string => typeof s === 'string',
      );
    }

    let severity: 'info' | 'warning' | 'error' = 'info';
    if (
      obj.severity === 'warning' ||
      obj.severity === 'error' ||
      obj.severity === 'info'
    ) {
      severity = obj.severity;
    }

    this.usage.record(USAGE_ANALYZE, usage);

    return {
      articleId,
      analysis,
      suggestions,
      severity,
    };
  }

  async generateFreeform(dto: GenerateAiDto): Promise<{ text: string }> {
    const { systemInstruction, userText } = buildFreeformGeneratePrompt(
      dto.prompt,
    );
    const { text, usage } = await this.invokeGemini({
      systemInstruction,
      userText,
    });
    this.usage.record(USAGE_GENERATE, usage);
    return { text: text.trim() };
  }
}
