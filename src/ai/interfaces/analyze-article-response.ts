export interface AnalyzeArticleResponse {
  articleId: string;
  analysis: string;
  suggestions: string[];
  severity: 'info' | 'warning' | 'error';
}
