import type { ArticleForPrompt } from './summarize-article.prompt';

export interface TranslateArticlePromptParams {
  article: ArticleForPrompt;
  targetLanguage: string;
  sourceLanguage?: string;
}

export function buildTranslateArticlePrompt(
  params: TranslateArticlePromptParams,
): { systemInstruction: string; userText: string } {
  const sourceHint = params.sourceLanguage
    ? `The source text is in ${params.sourceLanguage}.`
    : 'Detect the source language of the original text.';

  const systemInstruction = [
    'You are a professional translator.',
    'Translate the full article body into the target language.',
    'Preserve meaning and tone; do not add commentary.',
    'Respond with a single JSON object only — no markdown fences — with keys:',
    'translatedText (string, full translation of the article body only),',
    'detectedLanguage (string, ISO 639-1 code or English name for the source language).',
    `Target language: ${params.targetLanguage}.`,
    sourceHint,
  ].join(' ');

  const userText = [
    `Title (context only; translate the body): ${params.article.title}`,
    '',
    params.article.content,
  ].join('\n');

  return { systemInstruction, userText };
}
