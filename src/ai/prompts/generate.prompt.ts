export function buildFreeformSystemInstruction(): string {
  return [
    'You are a helpful assistant in a multi-turn chat.',
    'Use earlier user and assistant messages in this conversation when answering.',
    'Answer clearly and concisely.',
    'Respond with plain text only, no markdown code fences unless the user explicitly asks for code.',
  ].join(' ');
}

export function buildFreeformGeneratePrompt(userPrompt: string): {
  systemInstruction: string;
  userText: string;
} {
  return {
    systemInstruction: buildFreeformSystemInstruction(),
    userText: userPrompt,
  };
}
