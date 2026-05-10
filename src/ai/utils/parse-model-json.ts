import { HttpException, HttpStatus } from '@nestjs/common';

function stripCodeFence(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  return m?.[1]?.trim() ?? t;
}

export function parseModelJsonObject(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new HttpException(
      'AI returned invalid structured output',
      HttpStatus.BAD_GATEWAY,
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new HttpException(
      'AI returned invalid structured output',
      HttpStatus.BAD_GATEWAY,
    );
  }
  return parsed as Record<string, unknown>;
}
