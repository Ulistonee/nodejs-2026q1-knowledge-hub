export function buildFreeformGeneratePrompt(userPrompt: string): {
  systemInstruction: string;
  userText: string;
} {
  const systemInstruction =
    'You are a helpful assistant. Answer clearly and concisely. Respond with plain text only, no markdown code fences unless the user explicitly asks for code.';
  return {
    systemInstruction,
    userText: userPrompt,
  };
}
