import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { CommentService } from '../comment.service';

const buildCommentRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  content: 'Nice!',
  articleId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  authorId: null,
  createdAt: new Date('2026-01-03T00:00:00Z'),
  ...overrides,
});

describe('CommentService (unit)', () => {
  let service: CommentService;
  let prisma: {
    comment: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    article: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      comment: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      article: {
        findUnique: vi.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(CommentService);
  });

  afterEach(() => vi.clearAllMocks());

  it('findByArticleId maps rows to API shape', async () => {
    prisma.comment.findMany.mockResolvedValue([buildCommentRow()]);
    const list = (await service.findByArticleId(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      { articleId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    )) as unknown as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(typeof list[0].createdAt).toBe('number');
  });

  it('findOne throws NotFoundException when missing', async () => {
    prisma.comment.findUnique.mockResolvedValue(null);
    await expect(service.findOne('id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findOne returns mapped comment', async () => {
    prisma.comment.findUnique.mockResolvedValue(buildCommentRow());
    const out = await service.findOne('cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(out.content).toBe('Nice!');
  });

  it('create throws UnprocessableEntityException for missing article', async () => {
    prisma.article.findUnique.mockResolvedValue(null);
    await expect(
      service.create({
        content: 'hi',
        articleId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('create stores comment with null authorId by default', async () => {
    prisma.article.findUnique.mockResolvedValue({ id: 'a' });
    prisma.comment.create.mockResolvedValue(buildCommentRow());
    await service.create({
      content: 'hi',
      articleId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });
    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: {
        content: 'hi',
        articleId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        authorId: null,
      },
    });
  });

  it('create stores comment with provided authorId', async () => {
    prisma.article.findUnique.mockResolvedValue({ id: 'a' });
    prisma.comment.create.mockResolvedValue(
      buildCommentRow({ authorId: 'u1' }),
    );
    await service.create({
      content: 'hi',
      articleId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      authorId: 'u1',
    });
    expect(prisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: 'u1' }),
      }),
    );
  });

  it('remove throws NotFoundException for missing comment', async () => {
    prisma.comment.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove('id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remove resolves when one row deleted', async () => {
    prisma.comment.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.remove('id')).resolves.toBeUndefined();
  });
});
