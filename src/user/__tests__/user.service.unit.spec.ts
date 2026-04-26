import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserRole } from '../enums/user-role.enum';
import { UserService } from '../user.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

const mockedHash = bcrypt.hash as unknown as ReturnType<typeof vi.fn>;
const mockedCompare = bcrypt.compare as unknown as ReturnType<typeof vi.fn>;

const buildUserRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: '11111111-1111-1111-1111-111111111111',
  login: 'alice',
  password: 'hashed-password',
  role: UserRole.VIEWER,
  version: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('UserService (unit)', () => {
  let service: UserService;
  let prisma: {
    user: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    article: { updateMany: ReturnType<typeof vi.fn> };
    comment: { deleteMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      article: { updateMany: vi.fn() },
      comment: { deleteMany: vi.fn() },
      $transaction: vi.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(UserService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all users without password field', async () => {
      prisma.user.findMany.mockResolvedValue([buildUserRow()]);

      const result = (await service.findAll({})) as Array<
        Record<string, unknown>
      >;

      expect(prisma.user.findMany).toHaveBeenCalledOnce();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).not.toHaveProperty('password');
      expect(result[0].login).toBe('alice');
      expect(typeof result[0].createdAt).toBe('number');
    });

    it('paginates when page or limit is provided', async () => {
      prisma.user.findMany.mockResolvedValue([
        buildUserRow({ id: 'a', login: 'a' }),
        buildUserRow({ id: 'b', login: 'b' }),
        buildUserRow({ id: 'c', login: 'c' }),
      ]);

      const result = (await service.findAll({ page: 1, limit: 2 })) as {
        total: number;
        data: unknown[];
      };

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the user without password', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUserRow());

      const result = await service.findOne(
        '11111111-1111-1111-1111-111111111111',
      );

      expect(result).not.toHaveProperty('password');
      expect(result.login).toBe('alice');
    });
  });

  describe('create', () => {
    const dto: CreateUserDto = {
      login: 'alice',
      password: 'plain-password',
    };

    it('throws BadRequestException for duplicate login', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUserRow());

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes password and assigns default VIEWER role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockedHash.mockResolvedValue('hashed!');
      prisma.user.create.mockResolvedValue(
        buildUserRow({ password: 'hashed!' }),
      );

      const result = await service.create(dto);

      expect(mockedHash).toHaveBeenCalledWith('plain-password', 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          login: 'alice',
          password: 'hashed!',
          role: UserRole.VIEWER,
        },
      });
      expect(result).not.toHaveProperty('password');
    });

    it('respects an explicit role from DTO', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockedHash.mockResolvedValue('hashed!');
      prisma.user.create.mockResolvedValue(
        buildUserRow({ role: UserRole.ADMIN }),
      );

      await service.create({ ...dto, role: UserRole.ADMIN });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: UserRole.ADMIN }),
        }),
      );
    });
  });

  describe('update', () => {
    const userId = '11111111-1111-1111-1111-111111111111';

    it('throws BadRequestException when no fields are provided', async () => {
      await expect(
        service.update(userId, {} as UpdateUserDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update(userId, { role: UserRole.EDITOR }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when old password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUserRow());
      mockedCompare.mockResolvedValue(false);

      await expect(
        service.update(userId, {
          oldPassword: 'wrong',
          newPassword: 'next',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('updates password and increments version when match', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUserRow());
      mockedCompare.mockResolvedValue(true);
      mockedHash.mockResolvedValue('rehashed');
      prisma.user.update.mockResolvedValue(
        buildUserRow({ password: 'rehashed', version: 2 }),
      );

      const result = await service.update(userId, {
        oldPassword: 'plain',
        newPassword: 'next',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          password: 'rehashed',
          version: { increment: 1 },
        },
      });
      expect(result).not.toHaveProperty('password');
    });

    it('updates role only when role provided', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUserRow());
      prisma.user.update.mockResolvedValue(
        buildUserRow({ role: UserRole.ADMIN }),
      );

      await service.update(userId, { role: UserRole.ADMIN });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { role: UserRole.ADMIN },
      });
    });
  });

  describe('remove', () => {
    const userId = '11111111-1111-1111-1111-111111111111';

    it('throws NotFoundException when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.remove(userId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('detaches author from articles and deletes comments via transaction', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUserRow());
      prisma.article.updateMany.mockReturnValue('upd-articles' as never);
      prisma.comment.deleteMany.mockReturnValue('del-comments' as never);
      prisma.user.delete.mockReturnValue('del-user' as never);

      await service.remove(userId);

      expect(prisma.article.updateMany).toHaveBeenCalledWith({
        where: { authorId: userId },
        data: { authorId: null },
      });
      expect(prisma.comment.deleteMany).toHaveBeenCalledWith({
        where: { authorId: userId },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(prisma.$transaction).toHaveBeenCalledWith([
        'upd-articles',
        'del-comments',
        'del-user',
      ]);
    });
  });
});
