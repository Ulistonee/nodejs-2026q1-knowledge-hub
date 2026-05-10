import { z } from 'zod';

export type GeminiTranslateShape = z.infer<typeof geminiTranslateOutputSchema>;
export type GeminiAnalyzeShape = z.infer<typeof geminiAnalyzeOutputSchema>;

function trimStringFromUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value == null) {
    return '';
  }
  return String(value).trim();
}

function detectedLanguageFromUnknown(value: unknown): string {
  const s = trimStringFromUnknown(value);
  return s.length > 0 ? s : 'unknown';
}

function severityFromUnknown(value: unknown): 'info' | 'warning' | 'error' {
  if (value === 'info' || value === 'warning' || value === 'error') {
    return value;
  }
  return 'info';
}

function suggestionsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export const geminiTranslateOutputSchema = z
  .record(z.string(), z.unknown())
  .transform((record) => ({
    translatedText: trimStringFromUnknown(record.translatedText),
    detectedLanguage: detectedLanguageFromUnknown(record.detectedLanguage),
  }));

export const geminiAnalyzeOutputSchema = z
  .record(z.string(), z.unknown())
  .transform((record) => ({
    analysis:
      typeof record.analysis === 'string' ? record.analysis.trim() : '',
    suggestions: suggestionsFromUnknown(record.suggestions),
    severity: severityFromUnknown(record.severity),
  }));

export function safeParseGeminiTranslateOutput(
  raw: Record<string, unknown>,
): GeminiTranslateShape {
  const parsed = geminiTranslateOutputSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return {
    translatedText: '',
    detectedLanguage: 'unknown',
  };
}

export function safeParseGeminiAnalyzeOutput(
  raw: Record<string, unknown>,
): GeminiAnalyzeShape {
  const parsed = geminiAnalyzeOutputSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return {
    analysis: '',
    suggestions: [],
    severity: 'info',
  };
}
