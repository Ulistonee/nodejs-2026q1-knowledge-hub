import { describe, expect, it } from 'vitest';
import {
  geminiAnalyzeOutputSchema,
  geminiTranslateOutputSchema,
  safeParseGeminiAnalyzeOutput,
  safeParseGeminiTranslateOutput,
} from '../gemini-structured-output.schema';

describe('gemini-structured-output.schema (unit)', () => {
  it('translate: coerces types and defaults detectedLanguage', () => {
    const out = geminiTranslateOutputSchema.parse({
      translatedText: '  hello ',
      detectedLanguage: '',
    });
    expect(out).toEqual({
      translatedText: 'hello',
      detectedLanguage: 'unknown',
    });
  });

  it('translate: safeParse falls back on invalid root', () => {
    const out = safeParseGeminiTranslateOutput(null as unknown as Record<string, unknown>);
    expect(out.translatedText).toBe('');
    expect(out.detectedLanguage).toBe('unknown');
  });

  it('analyze: filters suggestions and defaults severity', () => {
    const out = geminiAnalyzeOutputSchema.parse({
      analysis: ' ok ',
      suggestions: ['a', 1, 'b', null],
      severity: 'nope',
    });
    expect(out.analysis).toBe('ok');
    expect(out.suggestions).toEqual(['a', 'b']);
    expect(out.severity).toBe('info');
  });

  it('analyze: safeParse falls back on invalid root', () => {
    const out = safeParseGeminiAnalyzeOutput(undefined as unknown as Record<string, unknown>);
    expect(out).toEqual({
      analysis: '',
      suggestions: [],
      severity: 'info',
    });
  });
});
