export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export interface GeminiGenerateResult {
  text: string;
  usage?: GeminiUsageMetadata;
}
