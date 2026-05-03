import type { ArticleForPrompt } from './summarize-article.prompt';

export type AnalyzeTask = 'review' | 'bugs' | 'optimize' | 'explain';

const TASK_FOCUS: Record<AnalyzeTask, string> = {
  review:
    'Give a structured review: strengths, weaknesses, clarity, and suggested improvements.',
  bugs:
    'Focus on factual inconsistencies, contradictions, unclear statements, and potential errors.',
  optimize:
    'Suggest concrete edits to improve clarity, structure, and engagement.',
  explain:
    'Explain the article in simpler terms for a reader unfamiliar with the topic.',
};

export function buildAnalyzeArticlePrompt(
  article: ArticleForPrompt,
  task: AnalyzeTask = 'review',
): { systemInstruction: string; userText: string } {
  const systemInstruction = [
    'You analyze article text and produce actionable insights.',
    'Respond with a single JSON object only — no markdown fences — with keys:',
    'analysis (string, main findings),',
    'suggestions (array of short strings, each one concrete action or fix),',
    'severity: one of "info", "warning", "error" — use "error" only for serious issues.',
    TASK_FOCUS[task],
  ].join(' ');

  const userText = [
    `Title: ${article.title}`,
    '',
    'Article body:',
    article.content,
  ].join('\n');

  return { systemInstruction, userText };
}
