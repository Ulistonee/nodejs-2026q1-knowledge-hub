export type SummarizeMaxLength = 'short' | 'medium' | 'detailed';

export interface ArticleForPrompt {
  title: string;
  content: string;
}

const LENGTH_GUIDANCE: Record<SummarizeMaxLength, string> = {
  short:
    'Keep the summary brief: roughly 1–3 sentences, capturing only the main idea.',
  medium:
    'Use a balanced summary: about one short paragraph with key points and context.',
  detailed:
    'Provide a detailed summary: several paragraphs covering main ideas, important facts, and structure of the original.',
};

export function buildSummarizeArticlePrompt(
  article: ArticleForPrompt,
  maxLength: SummarizeMaxLength = 'medium',
): { systemInstruction: string; userText: string } {
  const systemInstruction = [
    'You summarize articles for readers who need a clear, accurate overview.',
    'Respond with plain text only: the summary itself, with no preamble or labels.',
    LENGTH_GUIDANCE[maxLength],
  ].join(' ');

  const userText = [
    `Title: ${article.title}`,
    '',
    'Article body:',
    article.content,
  ].join('\n');

  return { systemInstruction, userText };
}
