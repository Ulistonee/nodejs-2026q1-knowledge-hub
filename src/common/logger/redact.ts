type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'passwordconfirmation',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'apikey',
  'api_key',
  'secret',
]);

const REDACTED = '[REDACTED]';

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        out[key] = REDACTED;
      } else {
        out[key] = redactSensitive(raw, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function redactString(input: string): string {
  if (!input) return input;
  return input
    .replace(
      /("(?:password|newPassword|oldPassword|currentPassword|passwordConfirmation|confirmPassword|token|accessToken|refreshToken|secret|apiKey|api_key)"\s*:\s*)"[^"]*"/gi,
      `$1"${REDACTED}"`,
    )
    .replace(
      /(authorization\s*[:=]\s*)("?[^"\s,}]+"?)/gi,
      `$1"${REDACTED}"`,
    );
}

export type { LogLevel };
export { SENSITIVE_KEYS, REDACTED };
