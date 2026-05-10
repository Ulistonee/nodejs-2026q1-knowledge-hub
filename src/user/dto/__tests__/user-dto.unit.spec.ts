import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UserRole } from '../../enums/user-role.enum';
import { CreateUserDto } from '../create-user.dto';
import { UpdatePasswordDto } from '../update-password.dto';
import { UpdateUserDto } from '../update-user.dto';

const validateDto = async <T extends object>(cls: new () => T, payload: unknown) => {
  const dto = plainToInstance(cls, payload);
  return validate(dto);
};

describe('CreateUserDto validation', () => {
  it('passes for a valid payload', async () => {
    const errors = await validateDto(CreateUserDto, {
      login: 'alice',
      password: 'secret',
      role: UserRole.VIEWER,
    });
    expect(errors).toHaveLength(0);
  });

  it('fails when required fields are missing', async () => {
    const errors = await validateDto(CreateUserDto, {});
    const properties = errors.map((e) => e.property);
    expect(properties).toEqual(expect.arrayContaining(['login', 'password']));
  });

  it('fails for empty login', async () => {
    const errors = await validateDto(CreateUserDto, {
      login: '',
      password: 'p',
    });
    expect(errors.some((e) => e.property === 'login')).toBe(true);
  });

  it('fails for invalid role enum', async () => {
    const errors = await validateDto(CreateUserDto, {
      login: 'a',
      password: 'p',
      role: 'superuser',
    });
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('fails for non-string password', async () => {
    const errors = await validateDto(CreateUserDto, {
      login: 'a',
      password: 12345,
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});

describe('UpdateUserDto validation', () => {
  it('passes for empty payload (all fields optional)', async () => {
    const errors = await validateDto(UpdateUserDto, {});
    expect(errors).toHaveLength(0);
  });

  it('fails for invalid role enum', async () => {
    const errors = await validateDto(UpdateUserDto, { role: 'bad' });
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('fails when password fields are non-strings', async () => {
    const errors = await validateDto(UpdateUserDto, {
      oldPassword: 1,
      newPassword: 2,
    });
    const props = errors.map((e) => e.property);
    expect(props).toEqual(
      expect.arrayContaining(['oldPassword', 'newPassword']),
    );
  });
});

describe('UpdatePasswordDto validation', () => {
  it('passes for valid input', async () => {
    const errors = await validateDto(UpdatePasswordDto, {
      oldPassword: 'a',
      newPassword: 'b',
    });
    expect(errors).toHaveLength(0);
  });

  it('fails when fields are missing', async () => {
    const errors = await validateDto(UpdatePasswordDto, {});
    const props = errors.map((e) => e.property);
    expect(props).toEqual(
      expect.arrayContaining(['oldPassword', 'newPassword']),
    );
  });
});
