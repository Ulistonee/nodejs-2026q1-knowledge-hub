import { describe, expect, it } from 'vitest';
import { redactSensitive, redactString, REDACTED } from '../redact';

describe('redactSensitive (unit)', () => {
  it('redacts password fields recursively in nested objects', () => {
    const input = {
      login: 'alice',
      password: 'plain123',
      profile: {
        token: 'jwt-here',
        nested: { newPassword: 'next' },
      },
    };
    const out = redactSensitive(input) as Record<string, unknown>;
    expect(out.login).toBe('alice');
    expect(out.password).toBe(REDACTED);
    const profile = out.profile as Record<string, unknown>;
    expect(profile.token).toBe(REDACTED);
    expect((profile.nested as Record<string, unknown>).newPassword).toBe(
      REDACTED,
    );
  });

  it('redacts inside arrays', () => {
    const out = redactSensitive([
      { password: 'a' },
      { token: 'b', name: 'kept' },
    ]) as Array<Record<string, unknown>>;
    expect(out[0].password).toBe(REDACTED);
    expect(out[1].token).toBe(REDACTED);
    expect(out[1].name).toBe('kept');
  });

  it('returns primitives unchanged', () => {
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive(undefined)).toBeUndefined();
    expect(redactSensitive(42)).toBe(42);
    expect(redactSensitive('hi')).toBe('hi');
    expect(redactSensitive(true)).toBe(true);
  });

  it('is case-insensitive on key names', () => {
    const out = redactSensitive({
      Password: 'x',
      AccessToken: 'y',
      ApiKey: 'z',
    }) as Record<string, unknown>;
    expect(out.Password).toBe(REDACTED);
    expect(out.AccessToken).toBe(REDACTED);
    expect(out.ApiKey).toBe(REDACTED);
  });

  it('stops recursing past depth limit', () => {
    type Cyclic = { value: string; child?: Cyclic };
    let chain: Cyclic = { value: 'leaf' };
    for (let i = 0; i < 12; i += 1) {
      chain = { value: 'wrap', child: chain };
    }
    expect(() => redactSensitive(chain)).not.toThrow();
  });
});

describe('redactString (unit)', () => {
  it('redacts password values inside JSON-like strings', () => {
    const input = '{"login":"alice","password":"plain"}';
    expect(redactString(input)).toBe('{"login":"alice","password":"[REDACTED]"}');
  });

  it('redacts token values inside JSON strings', () => {
    const input = '{"refreshToken":"abc.def.ghi","other":"keep"}';
    expect(redactString(input)).toContain('"refreshToken":"[REDACTED]"');
    expect(redactString(input)).toContain('"other":"keep"');
  });

  it('returns input untouched when there is nothing to redact', () => {
    expect(redactString('{"x":"y"}')).toBe('{"x":"y"}');
    expect(redactString('')).toBe('');
  });
});
