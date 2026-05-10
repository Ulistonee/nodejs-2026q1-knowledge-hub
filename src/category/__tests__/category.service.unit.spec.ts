import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../common/errors/app-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoryService } from '../category.service';

describe('CategoryService (unit)', () => {
  let service: CategoryService;
  let prisma: {
    category: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(CategoryService);
  });

  afterEach(() => vi.clearAllMocks());

  it('findAll returns rows passed through list-query', async () => {
    prisma.category.findMany.mockResolvedValue([
      { id: '1', name: 'a', description: 'desc' },
    ]);
    const result = (await service.findAll({})) as unknown[];
    expect(result).toHaveLength(1);
  });

  it('findOne throws NotFoundError for missing category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.findOne('id')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('findOne returns the category when found', async () => {
    const row = { id: '1', name: 'a', description: 'desc' };
    prisma.category.findUnique.mockResolvedValue(row);
    await expect(service.findOne('1')).resolves.toEqual(row);
  });

  it('create stores name and description', async () => {
    prisma.category.create.mockResolvedValue({ id: '1' });
    await service.create({ name: 'a', description: 'd' });
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'a', description: 'd' },
    });
  });

  it('update throws NotFoundError when category is missing', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(
      service.update('id', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('update only sends defined fields', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: '1' });
    prisma.category.update.mockResolvedValue({ id: '1', name: 'b' });
    await service.update('1', { name: 'b' });
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { name: 'b' },
    });
  });

  it('update sends both name and description when present', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: '1' });
    prisma.category.update.mockResolvedValue({ id: '1' });
    await service.update('1', { name: 'b', description: 'c' });
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { name: 'b', description: 'c' },
    });
  });

  it('remove throws NotFoundError when count is 0', async () => {
    prisma.category.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove('id')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('remove resolves when count > 0', async () => {
    prisma.category.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.remove('id')).resolves.toBeUndefined();
  });
});
