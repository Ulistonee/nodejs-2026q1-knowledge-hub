import { test, describe, expect, vi, beforeEach } from 'vitest';
import { SignupDto } from '../src/auth/dto/signup.dto';
import { validate } from 'class-validator';
import { AuthService } from '../src/auth/auth.service';
import * as bcrypt from 'bcrypt';

vi.mock('bcrypt', async (importOriginal) => {
    const actual = await importOriginal<typeof bcrypt>();
    return {
        ...actual,
        hash: vi.fn(actual.hash),
    };
});

describe('User signup data validation', () => {
    test('should fail if password is empty', async () => {
        const dto = new SignupDto();
        dto.login = 'test';
        dto.password = '';

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);

        const passwordError = errors.find(e => e.property === 'password');
        expect(passwordError).toBeDefined();
        expect(passwordError?.constraints).toHaveProperty('minLength');
    });
});

describe('Password hashing', () => {
    let authService: AuthService;

    beforeEach(() => {
        const prismaMock = {
            user: {
                findUnique: vi.fn().mockResolvedValue(null),
                count: vi.fn().mockResolvedValue(1),
                create: vi.fn().mockResolvedValue({ id: 'user-id-123' }),
            },
        };

        const jwtMock = {
            signAsync: vi.fn().mockResolvedValue('mock-token'),
        };

        authService = new AuthService(prismaMock as any, jwtMock as any);
    });

    test('should hash the password before saving', async () => {
        const hashSpy = vi.spyOn(bcrypt, 'hash');

        await authService.signup({ login: 'alice', password: 'secret123' });

        expect(hashSpy).toHaveBeenCalledWith('secret123', 10);
    });

    test('stored hash should not equal plain password', async () => {
        const dto: SignupDto = { login: 'bob', password: 'mypassword' };

        await authService.signup(dto);

        const createCall = (authService as any).prisma.user.create.mock.calls[0][0];
        const savedHash: string = createCall.data.password;

        expect(savedHash).not.toBe('mypassword');
        expect(await bcrypt.compare('mypassword', savedHash)).toBe(true);
    });
});