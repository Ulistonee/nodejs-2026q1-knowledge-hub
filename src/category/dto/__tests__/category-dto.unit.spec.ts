import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCategoryDto } from '../create-category.dto';
import { UpdateCategoryDto } from '../update-category.dto';

describe('CreateCategoryDto validation', () => {
  it('passes for a valid payload', async () => {
    const dto = plainToInstance(CreateCategoryDto, {
      name: 'Tech',
      description: 'About tech',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when fields are missing', async () => {
    const errors = await validate(plainToInstance(CreateCategoryDto, {}));
    const props = errors.map((e) => e.property);
    expect(props).toEqual(expect.arrayContaining(['name', 'description']));
  });
});

describe('UpdateCategoryDto validation', () => {
  it('passes for an empty payload (PartialType)', async () => {
    expect(
      await validate(plainToInstance(UpdateCategoryDto, {})),
    ).toHaveLength(0);
  });

  it('still validates that present fields are non-empty strings', async () => {
    const errors = await validate(
      plainToInstance(UpdateCategoryDto, { name: '' }),
    );
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });
});
