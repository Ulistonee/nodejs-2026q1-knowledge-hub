import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../common/errors/app-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

const mockedHash = bcrypt.hash as unknown as ReturnType<typeof vi.fn>;
const mockedCompare = bcrypt.compare as unknown as ReturnType<typeof vi.fn>;

describe('AuthService (unit)', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    revokedToken: {
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
  };
  let jwt: {
    signAsync: ReturnType<typeof vi.fn>;
    verifyAsync: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      revokedToken: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };
    jwt = {
      signAsync: vi.fn(),
      verifyAsync: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('signup', () => {
    it('throws ValidationError for duplicate login', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

      await expect(
        service.signup({ login: 'a', password: 'b' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('first-ever user becomes admin', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(0);
      mockedHash.mockResolvedValue('hashed');
      prisma.user.create.mockResolvedValue({ id: 'first-id' });

      const result = await service.signup({ login: 'a', password: 'b' });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { login: 'a', password: 'hashed', role: 'admin' },
      });
      expect(result).toEqual({ id: 'first-id' });
    });

    it('subsequent users get viewer role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(1);
      mockedHash.mockResolvedValue('hashed');
      prisma.user.create.mockResolvedValue({ id: 'next-id' });

      await service.signup({ login: 'a', password: 'b' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'viewer' }),
        }),
      );
    });
  });

  describe('login', () => {
    it('throws ForbiddenError when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ login: 'a', password: 'b' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws ForbiddenError when password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        login: 'a',
        password: 'hashed',
        role: 'viewer',
      });
      mockedCompare.mockResolvedValue(false);

      await expect(
        service.login({ login: 'a', password: 'wrong' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('returns access and refresh tokens for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        login: 'a',
        password: 'hashed',
        role: 'admin',
      });
      mockedCompare.mockResolvedValue(true);
      jwt.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login({ login: 'a', password: 'b' });

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(jwt.signAsync).toHaveBeenCalledTimes(2);
      expect(jwt.signAsync).toHaveBeenNthCalledWith(
        1,
        { userId: 'u1', login: 'a', role: 'admin' },
        expect.objectContaining({
          secret: process.env.JWT_SECRET_KEY,
        }),
      );
      expect(jwt.signAsync).toHaveBeenNthCalledWith(
        2,
        { userId: 'u1', login: 'a', role: 'admin' },
        expect.objectContaining({
          secret: process.env.JWT_SECRET_REFRESH_KEY,
        }),
      );
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedError for missing/empty refresh token', async () => {
      await expect(
        service.refresh({ refreshToken: '' }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      await expect(service.refresh({})).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    });

    it('throws ForbiddenError when token has been revoked', async () => {
      prisma.revokedToken.findUnique.mockResolvedValue({ token: 'revoked' });

      await expect(
        service.refresh({ refreshToken: 'revoked' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws ForbiddenError for tampered/expired token', async () => {
      prisma.revokedToken.findUnique.mockResolvedValue(null);
      jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.refresh({ refreshToken: 'bad' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('rotates tokens for valid refresh token', async () => {
      prisma.revokedToken.findUnique.mockResolvedValue(null);
      jwt.verifyAsync.mockResolvedValue({
        userId: 'u1',
        login: 'a',
        role: 'editor',
      });
      jwt.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');

      const result = await service.refresh({ refreshToken: 'good' });

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
    });
  });

  describe('logout', () => {
    it('blacklists token using its decoded expiration', async () => {
      const exp = Math.floor(Date.now() / 1000) + 60;
      jwt.verifyAsync.mockResolvedValue({ exp });

      await service.logout({ refreshToken: 'some-token' });

      expect(prisma.revokedToken.upsert).toHaveBeenCalledWith({
        where: { token: 'some-token' },
        update: {},
        create: expect.objectContaining({
          token: 'some-token',
          expiresAt: new Date(exp * 1000),
        }),
      });
    });

    it('blacklists even tampered tokens with default expiry', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      await service.logout({ refreshToken: 'tampered-token' });

      expect(prisma.revokedToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token: 'tampered-token' },
          create: expect.objectContaining({ token: 'tampered-token' }),
        }),
      );
    });
  });
});
