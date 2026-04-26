import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { LoginDto } from '../login.dto';
import { LogoutDto } from '../logout.dto';
import { RefreshDto } from '../refresh.dto';
import { SignupDto } from '../signup.dto';

describe('SignupDto validation', () => {
  it('passes for a valid payload', async () => {
    const dto = plainToInstance(SignupDto, {
      login: 'a',
      password: 'b',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when login or password is missing', async () => {
    const errors = await validate(plainToInstance(SignupDto, {}));
    const props = errors.map((e) => e.property);
    expect(props).toEqual(expect.arrayContaining(['login', 'password']));
  });

  it('fails for non-string fields', async () => {
    const errors = await validate(
      plainToInstance(SignupDto, { login: 1, password: true }),
    );
    expect(errors).toHaveLength(2);
  });
});

describe('LoginDto validation', () => {
  it('passes for a valid payload', async () => {
    expect(
      await validate(
        plainToInstance(LoginDto, { login: 'a', password: 'b' }),
      ),
    ).toHaveLength(0);
  });

  it('fails for missing fields', async () => {
    const errors = await validate(plainToInstance(LoginDto, {}));
    expect(errors).toHaveLength(2);
  });
});

describe('RefreshDto validation', () => {
  it('passes when token is omitted (optional)', async () => {
    expect(
      await validate(plainToInstance(RefreshDto, {})),
    ).toHaveLength(0);
  });

  it('passes for a string token', async () => {
    expect(
      await validate(plainToInstance(RefreshDto, { refreshToken: 'tok' })),
    ).toHaveLength(0);
  });

  it('fails for non-string token', async () => {
    const errors = await validate(
      plainToInstance(RefreshDto, { refreshToken: 12345 }),
    );
    expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
  });
});

describe('LogoutDto validation', () => {
  it('requires a non-empty refreshToken string', async () => {
    expect(
      await validate(plainToInstance(LogoutDto, { refreshToken: '' })),
    ).not.toHaveLength(0);
    expect(
      await validate(plainToInstance(LogoutDto, { refreshToken: 'x' })),
    ).toHaveLength(0);
  });
});
