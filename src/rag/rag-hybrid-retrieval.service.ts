import { Injectable } from '@nestjs/common';
import { ArticleStatus as PrismaArticleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RagVectorFilterInput } from './rag-vector-filter';
import { RagChunkingService } from './rag-chunking.service';
import { ragChunkPointId } from './rag-point-id';
import {
  RAG_HYBRID_LEXICAL_LIMIT,
  RAG_HYBRID_RERANK_CANDIDATES,
  RAG_RRF_K,
} from './rag.constants';
import type { VectorSearchHit } from './vector-store.client';

const STATUS_QUERY: Record<string, PrismaArticleStatus> = {
  draft: PrismaArticleStatus.DRAFT,
  published: PrismaArticleStatus.PUBLISHED,
  archived: PrismaArticleStatus.ARCHIVED,
};

const PRISMA_STATUS_LABEL: Record<PrismaArticleStatus, string> = {
  [PrismaArticleStatus.DRAFT]: 'draft',
  [PrismaArticleStatus.PUBLISHED]: 'published',
  [PrismaArticleStatus.ARCHIVED]: 'archived',
};

function chunkDedupeKey(hit: VectorSearchHit): string {
  const aid = String(hit.payload?.articleId ?? '');
  const raw = hit.payload?.chunkIndex;
  const idx =
    typeof raw === 'number'
      ? raw
      : Number.parseInt(String(raw ?? ''), 10);
  return `${aid}:${Number.isFinite(idx) ? idx : -1}`;
}

function tokenizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

@Injectable()
export class RagHybridRetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chunking: RagChunkingService,
  ) {}

  async lexicalArticleIds(
    query: string,
    limit: number,
    filters: RagVectorFilterInput,
  ): Promise<string[]> {
    const q = query.trim();
    if (!q.length) {
      return [];
    }

    const cap = Math.max(1, Math.min(limit, RAG_HYBRID_LEXICAL_LIMIT));
    const conditions: Prisma.Sql[] = [
      Prisma.sql`to_tsvector('simple', coalesce(a.title,'') || ' ' || coalesce(a.content,'')) @@ plainto_tsquery('simple', ${q})`,
    ];

    if (filters.status?.trim()) {
      const st = STATUS_QUERY[filters.status.trim().toLowerCase()];
      if (st !== undefined) {
        conditions.push(Prisma.sql`a.status = ${st}::"ArticleStatus"`);
      }
    }

    if (filters.categoryId?.trim()) {
      conditions.push(
        Prisma.sql`a."categoryId" = ${filters.categoryId}::uuid`,
      );
    }

    for (const tag of filters.tags ?? []) {
      const t = typeof tag === 'string' ? tag.trim() : '';
      if (!t.length) {
        continue;
      }
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM "_ArticleToTag" att INNER JOIN "Tag" tg ON tg.id = att."B" WHERE att."A" = a.id AND tg.name = ${t})`,
      );
    }

    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT a.id
      FROM "Article" a
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY ts_rank_cd(
        to_tsvector('simple', coalesce(a.title,'') || ' ' || coalesce(a.content,'')),
        plainto_tsquery('simple', ${q})
      ) DESC
      LIMIT ${cap}
    `);

    return rows.map((r) => r.id);
  }

  mergeRrf(
    vectorHits: VectorSearchHit[],
    lexicalArticleIds: string[],
    syntheticHits: VectorSearchHit[],
  ): VectorSearchHit[] {
    const k = RAG_RRF_K;
    const synthByArticle = new Map<string, VectorSearchHit>();
    for (const sh of syntheticHits) {
      const aid = String(sh.payload?.articleId ?? '');
      if (aid) {
        synthByArticle.set(aid, sh);
      }
    }

    const rrfByKey = new Map<string, number>();
    const hitByKey = new Map<string, VectorSearchHit>();

    for (let i = 0; i < vectorHits.length; i++) {
      const h = vectorHits[i];
      const key = chunkDedupeKey(h);
      rrfByKey.set(key, (rrfByKey.get(key) ?? 0) + 1 / (k + i + 1));
      hitByKey.set(key, h);
    }

    for (let li = 0; li < lexicalArticleIds.length; li++) {
      const aid = lexicalArticleIds[li];
      const contrib = 1 / (k + li + 1);

      let hitAnyChunk = false;
      for (const h of vectorHits) {
        if (String(h.payload?.articleId ?? '') === aid) {
          const key = chunkDedupeKey(h);
          rrfByKey.set(key, (rrfByKey.get(key) ?? 0) + contrib);
          hitAnyChunk = true;
        }
      }

      if (!hitAnyChunk) {
        const syn = synthByArticle.get(aid);
        if (syn) {
          const key = chunkDedupeKey(syn);
          rrfByKey.set(key, (rrfByKey.get(key) ?? 0) + contrib);
          hitByKey.set(key, syn);
        }
      }
    }

    const merged = [...rrfByKey.entries()]
      .map(([key, rrfScore]) => {
        const hit = hitByKey.get(key);
        return hit ? { hit, rrfScore } : null;
      })
      .filter((x): x is { hit: VectorSearchHit; rrfScore: number } => x !== null);

    merged.sort((a, b) => b.rrfScore - a.rrfScore);
    return merged.map(({ hit, rrfScore }) => ({ ...hit, score: rrfScore }));
  }

  rerankByTokenOverlap(query: string, hits: VectorSearchHit[]): VectorSearchHit[] {
    const tokens = tokenizeQuery(query);
    if (hits.length <= 1 || tokens.length === 0) {
      return hits.slice(0, RAG_HYBRID_RERANK_CANDIDATES);
    }

    const pool = hits.slice(
      0,
      Math.min(hits.length, RAG_HYBRID_RERANK_CANDIDATES),
    );

    const alpha = 0.62;

    const scored = pool.map((hit) => {
      const title = typeof hit.payload?.title === 'string' ? hit.payload.title : '';
      const body =
        typeof hit.payload?.chunkText === 'string' ? hit.payload.chunkText : '';
      const hay = `${title}\n${body}`.toLowerCase();
      let overlap = 0;
      for (const t of tokens) {
        if (hay.includes(t)) {
          overlap++;
        }
      }
      const norm = overlap / tokens.length;
      const combined = alpha * hit.score + (1 - alpha) * norm;
      return { hit: { ...hit, score: combined }, combined };
    });

    scored.sort((a, b) => b.combined - a.combined);
    return scored.map((s) => s.hit);
  }

  async syntheticFirstChunkHit(articleId: string): Promise<VectorSearchHit | null> {
    const row = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { tags: true },
    });
    if (!row) {
      return null;
    }

    const body = `${row.title.trim()}\n\n${row.content}`;
    const parts = this.chunking.chunkArticleText(body);
    const chunkText = (parts[0] ?? row.title).trim() || row.title;
    const tagNames = row.tags.map((t) => t.name);
    const categoryIdPayload =
      row.categoryId === undefined || row.categoryId === null
        ? null
        : row.categoryId;

    return {
      id: ragChunkPointId(articleId, 0),
      score: 0,
      payload: {
        articleId,
        title: row.title,
        chunkIndex: 0,
        chunkText,
        status: PRISMA_STATUS_LABEL[row.status],
        categoryId: categoryIdPayload,
        tags: tagNames,
        updatedAtMs: row.updatedAt.getTime(),
      },
    };
  }
}
