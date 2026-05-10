import { Test } from '@nestjs/testing';
import { ArticleStatus as PrismaArticleStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/app-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { RagVectorSyncService } from '../../rag/rag-vector-sync.service';
import { ArticleService } from '../article.service';
import { CreateArticleDto } from '../dto/create-article.dto';
import { ArticleStatus } from '../enums/article-status.enum';

const buildArticleRow = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  title: 'Hello',
  content: 'World',
  status: PrismaArticleStatus.DRAFT,
  authorId: null,
  categoryId: null,
  tags: [],
  createdAt: new Date('2026-01-02T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  ...overrides,
});

describe('ArticleService (unit)', () => {
  let service: ArticleService;
  let ragSync: { removeArticleVectorsSafe: ReturnType<typeof vi.fn> };
  let prisma: {
    article: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    tag: { upsert: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    ragSync = {
      removeArticleVectorsSafe: vi.fn().mockResolvedValue(undefined),
    };

    prisma = {
      article: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
      tag: { upsert: vi.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ArticleService,
        { provide: PrismaService, useValue: prisma },
        { provide: RagVectorSyncService, useValue: ragSync },
      ],
    }).compile();

    service = moduleRef.get(ArticleService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('findAll - filtering & pagination', () => {
    it('filters by status, categoryId and tag', async () => {
      prisma.article.findMany.mockResolvedValue([buildArticleRow()]);

      await service.findAll({
        status: 'published',
        categoryId: 'cat-1',
        tag: 'nest',
      });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: PrismaArticleStatus.PUBLISHED,
            categoryId: 'cat-1',
            tags: { some: { name: 'nest' } },
          },
          include: { tags: true },
        }),
      );
    });

    it('throws ValidationError for invalid sortBy', async () => {
      await expect(
        service.findAll({ sortBy: 'unknownField' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('skips orderBy when sortBy is empty string', async () => {
      prisma.article.findMany.mockResolvedValue([]);

      await service.findAll({ sortBy: '' });

      const callArg = prisma.article.findMany.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('orderBy');
    });

    it('builds desc orderBy when order is desc', async () => {
      prisma.article.findMany.mockResolvedValue([]);
      await service.findAll({ sortBy: 'title', order: 'desc' });
      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { title: 'desc' } }),
      );
    });

    it('paginates when page or limit provided', async () => {
      prisma.article.count.mockResolvedValue(20);
      prisma.article.findMany.mockResolvedValue([buildArticleRow()]);

      const result = (await service.findAll({ page: 2, limit: 5 })) as {
        total: number;
        page: number;
        limit: number;
        data: unknown[];
      };

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
      expect(result).toMatchObject({ total: 20, page: 2, limit: 5 });
      expect(result.data).toHaveLength(1);
    });

    it('returns a plain array (no pagination envelope) when page and limit are omitted', async () => {
      prisma.article.findMany.mockResolvedValue([
        buildArticleRow({ id: 'a-1' }),
        buildArticleRow({ id: 'a-2' }),
      ]);

      const result = await service.findAll({});

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(prisma.article.count).not.toHaveBeenCalled();
      const callArg = prisma.article.findMany.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('skip');
      expect(callArg).not.toHaveProperty('take');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundError when not found', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      await expect(service.findOne('id')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('maps the row to API representation', async () => {
      prisma.article.findUnique.mockResolvedValue(
        buildArticleRow({
          tags: [{ id: 't1', name: 'nest' }],
          status: PrismaArticleStatus.PUBLISHED,
        }),
      );

      const article = await service.findOne('any');

      expect(article.tags).toEqual(['nest']);
      expect(article.status).toBe(ArticleStatus.PUBLISHED);
      expect(typeof article.createdAt).toBe('number');
    });
  });

  describe('create', () => {
    it('creates with default DRAFT status and connectOrCreates tags', async () => {
      const dto: CreateArticleDto = {
        title: 'Title',
        content: 'Content',
        tags: ['tag1', 'tag2'],
      };
      prisma.article.create.mockResolvedValue(
        buildArticleRow({
          tags: [
            { id: '1', name: 'tag1' },
            { id: '2', name: 'tag2' },
          ],
        }),
      );

      const created = await service.create(dto);

      expect(prisma.article.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PrismaArticleStatus.DRAFT,
            tags: {
              connectOrCreate: [
                { where: { name: 'tag1' }, create: { name: 'tag1' } },
                { where: { name: 'tag2' }, create: { name: 'tag2' } },
              ],
            },
          }),
          include: { tags: true },
        }),
      );
      expect(created.tags).toEqual(['tag1', 'tag2']);
    });

    it('respects explicit PUBLISHED status', async () => {
      prisma.article.create.mockResolvedValue(
        buildArticleRow({ status: PrismaArticleStatus.PUBLISHED }),
      );

      await service.create({
        title: 'a',
        content: 'b',
        status: ArticleStatus.PUBLISHED,
      });

      expect(prisma.article.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PrismaArticleStatus.PUBLISHED,
          }),
        }),
      );
    });
  });

  describe('update', () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    it('throws NotFoundError for missing article', async () => {
      prisma.article.findUnique.mockResolvedValue(null);
      await expect(
        service.update(id, { title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('blocks editor from updating articles they do not own', async () => {
      prisma.article.findUnique.mockResolvedValue(
        buildArticleRow({ authorId: 'other-user' }),
      );

      await expect(
        service.update(
          id,
          { title: 'x' },
          { userId: 'me', role: 'editor' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('allows editor to update their own articles', async () => {
      prisma.article.findUnique.mockResolvedValue(
        buildArticleRow({ authorId: 'me' }),
      );
      prisma.article.update.mockResolvedValue(buildArticleRow());

      await expect(
        service.update(
          id,
          { title: 'x' },
          { userId: 'me', role: 'editor' },
        ),
      ).resolves.toBeDefined();
    });

    it('transitions DRAFT → PUBLISHED → ARCHIVED', async () => {
      prisma.article.findUnique
        .mockResolvedValueOnce(
          buildArticleRow({ status: PrismaArticleStatus.DRAFT }),
        )
        .mockResolvedValueOnce(
          buildArticleRow({ status: PrismaArticleStatus.PUBLISHED }),
        );

      prisma.article.update
        .mockResolvedValueOnce(
          buildArticleRow({ status: PrismaArticleStatus.PUBLISHED }),
        )
        .mockResolvedValueOnce(
          buildArticleRow({ status: PrismaArticleStatus.ARCHIVED }),
        );

      const published = await service.update(id, {
        status: ArticleStatus.PUBLISHED,
      });
      const archived = await service.update(id, {
        status: ArticleStatus.ARCHIVED,
      });

      expect(published.status).toBe(ArticleStatus.PUBLISHED);
      expect(archived.status).toBe(ArticleStatus.ARCHIVED);
    });

    it('updates tags via upsert + set', async () => {
      prisma.article.findUnique.mockResolvedValue(buildArticleRow());
      prisma.tag.upsert
        .mockResolvedValueOnce({ id: 't1', name: 'one' })
        .mockResolvedValueOnce({ id: 't2', name: 'two' });
      prisma.article.update.mockResolvedValue(
        buildArticleRow({
          tags: [
            { id: 't1', name: 'one' },
            { id: 't2', name: 'two' },
          ],
        }),
      );

      const updated = await service.update(id, { tags: ['one', 'two'] });

      expect(prisma.tag.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.article.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: { set: [{ id: 't1' }, { id: 't2' }] },
          }),
        }),
      );
      expect(updated.tags).toEqual(['one', 'two']);
    });

    it('passes through field-by-field updates', async () => {
      prisma.article.findUnique.mockResolvedValue(buildArticleRow());
      prisma.article.update.mockResolvedValue(buildArticleRow());

      await service.update(id, {
        title: 'new',
        content: 'body',
        authorId: 'author-1',
        categoryId: 'cat-1',
      });

      expect(prisma.article.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'new',
            content: 'body',
            authorId: 'author-1',
            categoryId: 'cat-1',
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundError when nothing was deleted', async () => {
      prisma.article.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove('id')).rejects.toBeInstanceOf(NotFoundError);
      expect(ragSync.removeArticleVectorsSafe).not.toHaveBeenCalled();
    });

    it('resolves when delete count > 0', async () => {
      prisma.article.deleteMany.mockResolvedValue({ count: 1 });
      await expect(service.remove('id')).resolves.toBeUndefined();
      expect(ragSync.removeArticleVectorsSafe).toHaveBeenCalledWith('id');
    });
  });
});
