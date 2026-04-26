import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY, Public } from '../public.decorator';
import { ROLES_KEY, Roles } from '../roles.decorator';

describe('Public decorator', () => {
  it('attaches IS_PUBLIC_KEY metadata = true to the target', () => {
    class Sample {}
    Public()(Sample);

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Sample)).toBe(true);
  });
});

describe('Roles decorator', () => {
  it('stores the list of roles under ROLES_KEY', () => {
    class Sample {}
    Roles('admin', 'editor')(Sample);

    expect(Reflect.getMetadata(ROLES_KEY, Sample)).toEqual([
      'admin',
      'editor',
    ]);
  });

  it('supports an empty roles list', () => {
    class Sample {}
    Roles()(Sample);
    expect(Reflect.getMetadata(ROLES_KEY, Sample)).toEqual([]);
  });
});
