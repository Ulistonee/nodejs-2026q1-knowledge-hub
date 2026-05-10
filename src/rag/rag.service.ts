import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ArticleStatus as PrismaArticleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  RagChatStoreService,
  type RagConvMessage,
} from './rag-chat-store.service';
import { RagChunkingService } from './rag-chunking.service';
import type { RagConfig } from './rag.config';
import { RagGeminiService } from './rag-gemini.service';
import { RagHybridRetrievalService } from './rag-hybrid-retrieval.service';
import { RagIndexDto } from './dto/rag-index.dto';
import { RagChatDto } from './dto/rag-chat.dto';
import { RagSearchDto } from './dto/rag-search.dto';
import { ragChunkPointId } from './rag-point-id';
import { buildQdrantMetadataFilter } from './rag-vector-filter';
import {
  DEFAULT_RAG_SEARCH_LIMIT,
  MAX_RAG_SEARCH_LIMIT,
  RAG_CHAT_RETRIEVE_LIMIT,
  RAG_CHUNK_EXCERPT_CHARS,
  RAG_HYBRID_LEXICAL_LIMIT,
  RAG_HYBRID_VECTOR_POOL,
  RAG_PROMPT_CHARS_CAP,
} from './rag.constants';
import { RAG_CONFIG } from './rag.tokens';
import type { VectorSearchHit } from './vector-store.client';
import { VectorStoreClient } from './vector-store.client';

const PRISMA_STATUS_LABEL: Record<PrismaArticleStatus, string> = {
  [PrismaArticleStatus.DRAFT]: 'draft',
  [PrismaArticleStatus.PUBLISHED]: 'published',
  [PrismaArticleStatus.ARCHIVED]: 'archived',
};

const UPSERT_BATCH = 80;

interface PendingChunk {
  articleId: string;
  title: string;
  chunkIndex: number;
  chunkText: string;
  status: PrismaArticleStatus;
  categoryId: string | null;
  tags: string[];
  updatedAtMs: number;
}

@Injectable()
export class RagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ragGemini: RagGeminiService,
    private readonly vector: VectorStoreClient,
    private readonly chunking: RagChunkingService,
    private readonly ragChat: RagChatStoreService,
    private readonly hybrid: RagHybridRetrievalService,
    @Inject(RAG_CONFIG)
    private readonly rag: RagConfig,
  ) {}

  async index(dto: RagIndexDto): Promise<{
    collection: string;
    articlesMatched: number;
    chunksIndexed: number;
    pointsUpserted: number;
  }> {
    const onlyPublished = dto.onlyPublished !== false;
    const where: Prisma.ArticleWhereInput = {};
    if (onlyPublished) {
      where.status = PrismaArticleStatus.PUBLISHED;
    }
    if (dto.articleIds?.length) {
      where.id = { in: dto.articleIds };
    }

    if (dto.updatedAfter?.trim()) {
      const d = new Date(dto.updatedAfter.trim());
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException(
          'updatedAfter must be a valid ISO-8601 date string',
        );
      }
      where.updatedAt = { gt: d };
    }

    const articles = await this.prisma.article.findMany({
      where,
      include: { tags: true },
    });

    const pending: PendingChunk[] = [];
    for (const article of articles) {
      const body = `${article.title.trim()}\n\n${article.content}`;
      const parts = this.chunking.chunkArticleText(body);
      const tagNames = article.tags.map((t) => t.name);
      const updatedAtMs = article.updatedAt.getTime();

      parts.forEach((chunkText, chunkIndex) => {
        const text = chunkText.trim();
        if (!text.length) {
          return;
        }
        pending.push({
          articleId: article.id,
          title: article.title,
          chunkIndex,
          chunkText: text,
          status: article.status,
          categoryId: article.categoryId,
          tags: tagNames,
          updatedAtMs,
        });
      });
    }

    const collection = this.rag.vectorCollection;

    if (articles.length === 0) {
      return {
        collection,
        articlesMatched: 0,
        chunksIndexed: 0,
        pointsUpserted: 0,
      };
    }

    if (pending.length === 0) {
      if (this.rag.vectorDbUrl) {
        try {
          await this.vector.ensureCollection(
            collection,
            this.rag.embeddingDimensions,
          );
        } catch {
        }
        for (const article of articles) {
          try {
            await this.vector.deleteChunksForArticle(collection, article.id);
          } catch {
          }
        }
      }

      return {
        collection,
        articlesMatched: articles.length,
        chunksIndexed: 0,
        pointsUpserted: 0,
      };
    }

    const embeddings = await this.ragGemini.embedTexts(
      pending.map((p) => p.chunkText),
    );
    const dim =
      embeddings[0]?.length ?? this.rag.embeddingDimensions ?? 768;
    await this.vector.ensureCollection(collection, dim);

    const points = pending.map((p, idx) => {
      const embedding = embeddings[idx];
      if (!embedding?.length) {
        throw new HttpException(
          'Embedding service returned insufficient vectors',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const categoryIdPayload =
        p.categoryId === undefined || p.categoryId === null
          ? null
          : p.categoryId;

      return {
        id: ragChunkPointId(p.articleId, p.chunkIndex),
        vector: embedding,
        payload: {
          articleId: p.articleId,
          title: p.title,
          chunkIndex: p.chunkIndex,
          chunkText: p.chunkText,
          status: PRISMA_STATUS_LABEL[p.status],
          categoryId: categoryIdPayload,
          tags: p.tags,
          updatedAtMs: p.updatedAtMs,
        },
      };
    });

    for (let i = 0; i < points.length; i += UPSERT_BATCH) {
      await this.vector.upsert(collection, points.slice(i, i + UPSERT_BATCH));
    }

    await this.pruneStaleChunksAfterIndex(collection, articles, pending);

    return {
      collection,
      articlesMatched: articles.length,
      chunksIndexed: pending.length,
      pointsUpserted: points.length,
    };
  }

  async search(dto: RagSearchDto): Promise<{
    collection: string;
    retrieval: 'hybrid' | 'vector';
    hits: Array<{
      id: string;
      score: number;
      articleId: string;
      title: string;
      chunkIndex: number;
      status?: string;
      categoryId?: string | null;
      tags?: string[];
      snippet?: string;
    }>;
  }> {
    const limit = Math.min(
      MAX_RAG_SEARCH_LIMIT,
      Math.max(1, dto.limit ?? DEFAULT_RAG_SEARCH_LIMIT),
    );
    const hybrid = dto.hybrid !== false;

    const collection = this.rag.vectorCollection;
    const raw = await this.retrieveChunksForQuery({
      query: dto.query,
      limit,
      hybrid,
      status: dto.status,
      categoryId: dto.categoryId,
      tags: dto.tags,
    });

    return {
      collection,
      retrieval: hybrid ? 'hybrid' : 'vector',
      hits: raw.map((h) => this.mapHitToSearchRow(h)),
    };
  }

  async deleteIndexedArticle(articleId: string): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true },
    });
    if (!article) {
      throw new NotFoundException(`Article ${articleId} not found`);
    }

    const collection = this.rag.vectorCollection;
    const hasChunks = await this.vector.hasChunksForArticle(
      collection,
      articleId,
    );
    if (!hasChunks) {
      throw new NotFoundException(
        `No indexed vectors for article ${articleId} (index with POST /ai/rag/index, or collection may be missing).`,
      );
    }

    await this.vector.deleteChunksForArticle(collection, articleId);
  }

  getChatHistory(conversationId: string): {
    conversationId: string;
    messages: RagConvMessage[];
  } {
    const msgs = this.ragChat.getHistory(conversationId);
    if (!msgs) {
      throw new NotFoundException(
        `Conversation ${conversationId} not found or expired`,
      );
    }
    return { conversationId, messages: msgs };
  }

  async chat(dto: RagChatDto): Promise<{
    conversationId: string;
    answer: string;
    sources: Array<{
      articleId: string;
      title: string;
      chunkIndex: number;
      score: number;
    }>;
  }> {
    const { id: conversationId, priorMessages } =
      this.ragChat.resolve(dto.conversationId);

    const hybrid = dto.hybrid !== false;
    const retrieval = await this.retrieveChunksForQuery({
      query: dto.question,
      limit: RAG_CHAT_RETRIEVE_LIMIT,
      hybrid,
      status: dto.status,
      categoryId: dto.categoryId,
      tags: dto.tags,
    });

    const excerptsJoined = retrieval
      .map((hit, idx) =>
        RagService.formatRetrieverExcerpt(hit, idx + 1, RAG_CHUNK_EXCERPT_CHARS),
      )
      .join('\n\n---\n\n');

    let systemInstruction = [
      'You assist users with the Knowledge Hub article corpus.',
      'Ground your answer primarily in the excerpt blocks below.',
      'If excerpts are insufficient, clearly say information is not available there.',
      'Do not fabricate citations or unseen article metadata.',
      'Excerpts:\n\n' + excerptsJoined,
    ].join('\n\n');

    if (systemInstruction.length > RAG_PROMPT_CHARS_CAP) {
      systemInstruction =
        systemInstruction.slice(0, RAG_PROMPT_CHARS_CAP) +
        '\n\n[truncated for length]';
    }

    const contents: Array<{ role: 'user' | 'model'; text: string }> = [
      ...priorMessages.map((m) => ({
        role: (m.role === 'model' ? 'model' : 'user') as 'user' | 'model',
        text: m.text,
      })),
      { role: 'user', text: dto.question },
    ];

    const result = await this.ragGemini.generateContentMultiTurn({
      systemInstruction,
      contents,
    });

    this.ragChat.commitTurn(conversationId, dto.question, result.text);

    return {
      conversationId,
      answer: result.text,
      sources: retrieval.map((h) => ({
        articleId: String(h.payload?.articleId ?? ''),
        title: String(h.payload?.title ?? ''),
        chunkIndex: Number(h.payload?.chunkIndex ?? -1),
        score: h.score,
      })),
    };
  }

  private async retrieveChunksForQuery(options: {
    query: string;
    limit: number;
    hybrid: boolean;
    status?: string;
    categoryId?: string;
    tags?: string[];
  }): Promise<VectorSearchHit[]> {
    const filter = buildQdrantMetadataFilter({
      status: options.status,
      categoryId: options.categoryId,
      tags: options.tags,
    });

    const collection = this.rag.vectorCollection;
    const [qVec] = await this.ragGemini.embedTexts([options.query]);

    const vecLimit = options.hybrid ? RAG_HYBRID_VECTOR_POOL : options.limit;
    let raw = await this.vector.search(
      collection,
      qVec,
      vecLimit,
      filter ?? undefined,
    );

    if (!options.hybrid) {
      return raw.slice(0, options.limit);
    }

    const lexicalIds = await this.hybrid.lexicalArticleIds(
      options.query,
      RAG_HYBRID_LEXICAL_LIMIT,
      {
        status: options.status,
        categoryId: options.categoryId,
        tags: options.tags,
      },
    );

    if (!lexicalIds.length) {
      return raw.slice(0, options.limit);
    }

    const inVector = new Set(
      raw.map((h) => String(h.payload?.articleId ?? '')),
    );

    const lexicalOnly = lexicalIds.filter((id) => !inVector.has(id));
    const synths: VectorSearchHit[] = [];
    for (const aid of lexicalOnly) {
      const syn = await this.hybrid.syntheticFirstChunkHit(aid);
      if (syn) {
        synths.push(syn);
      }
    }

    let merged = this.hybrid.mergeRrf(raw, lexicalIds, synths);
    merged = this.hybrid.rerankByTokenOverlap(options.query, merged);
    return merged.slice(0, options.limit);
  }

  private async pruneStaleChunksAfterIndex(
    collection: string,
    articles: Array<{ id: string }>,
    pending: PendingChunk[],
  ): Promise<void> {
    const maxChunkIdx = new Map<string, number>();
    for (const p of pending) {
      maxChunkIdx.set(
        p.articleId,
        Math.max(maxChunkIdx.get(p.articleId) ?? -1, p.chunkIndex),
      );
    }

    for (const article of articles) {
      const mx = maxChunkIdx.get(article.id);
      try {
        if (mx === undefined) {
          await this.vector.deleteChunksForArticle(collection, article.id);
        } else {
          await this.vector.deleteChunksForArticleFromChunkIndex(
            collection,
            article.id,
            mx + 1,
          );
        }
      } catch {
        /* best-effort prune */
      }
    }
  }

  private mapHitToSearchRow(hit: VectorSearchHit): {
    id: string;
    score: number;
    articleId: string;
    title: string;
    chunkIndex: number;
    status?: string;
    categoryId?: string | null;
    tags?: string[];
    snippet?: string;
  } {
    const p = hit.payload ?? {};
    const chunkRaw = typeof p.chunkText === 'string' ? p.chunkText : '';
    const snippet =
      chunkRaw.length > 500 ? `${chunkRaw.slice(0, 500)}…` : chunkRaw;

    const tagsPayload = Array.isArray(p.tags)
      ? (p.tags as unknown[]).map((x) => String(x))
      : [];

    const categoryPayload =
      p.categoryId === null || p.categoryId === undefined || p.categoryId === ''
        ? null
        : String(p.categoryId);

    return {
      id: hit.id,
      score: hit.score,
      articleId: String(p.articleId ?? ''),
      title: String(p.title ?? ''),
      chunkIndex: (() => {
        const idx =
          typeof p.chunkIndex === 'number'
            ? p.chunkIndex
            : Number.parseInt(String(p.chunkIndex ?? ''), 10);
        return Number.isFinite(idx) ? idx : -1;
      })(),
      status:
        typeof p.status === 'string' && p.status.length ? p.status : undefined,
      categoryId: categoryPayload,
      tags: tagsPayload.length ? tagsPayload : undefined,
      snippet,
    };
  }

  private static formatRetrieverExcerpt(
    hit: VectorSearchHit,
    ordinal: number,
    maxChars: number,
  ): string {
    const p = hit.payload ?? {};
    const title = typeof p.title === 'string' ? p.title : '';
    const articleId =
      typeof p.articleId === 'string' ? p.articleId : String(p.articleId ?? '');
    let body = typeof p.chunkText === 'string' ? p.chunkText : '';
    if (body.length > maxChars) {
      body = `${body.slice(0, maxChars)}…`;
    }

    const score = hit.score;

    return [
      `[chunk #${ordinal} | score=${score.toFixed(4)} | article=${articleId}]`,
      title ? `Title: ${title}` : undefined,
      body,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
