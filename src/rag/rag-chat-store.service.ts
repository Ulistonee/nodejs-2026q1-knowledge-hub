import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RagConfig } from './rag.config';
import { loadGeminiConfig } from '../ai/gemini.config';
import { RAG_CONFIG } from './rag.tokens';

export type RagConvRole = 'user' | 'model';

export interface RagConvMessage {
  role: RagConvRole;
  text: string;
}

interface SessionState {
  messages: RagConvMessage[];
  updatedAt: number;
}

@Injectable()
export class RagChatStoreService {
  private readonly store = new Map<string, SessionState>();
  private readonly ttlMs: number;

  constructor(
    @Inject(RAG_CONFIG)
    private readonly rag: RagConfig,
  ) {
    const c = loadGeminiConfig();
    this.ttlMs = Math.max(1000, c.aiConversationTtlSec * 1000);
  }

  getHistory(conversationId: string): RagConvMessage[] | null {
    this.evictExpired();
    const trimmed = conversationId?.trim();
    if (!trimmed) {
      return null;
    }
    const state = this.store.get(trimmed);
    if (!state) {
      return null;
    }
    if (Date.now() - state.updatedAt > this.ttlMs) {
      return null;
    }
    return [...state.messages];
  }

  resolve(conversationId?: string): { id: string; priorMessages: RagConvMessage[] } {
    this.evictExpired();

    const trimmed = conversationId?.trim();
    const now = Date.now();

    if (!trimmed) {
      const id = randomUUID();
      const state: SessionState = { messages: [], updatedAt: now };
      this.store.set(id, state);
      return { id, priorMessages: [] };
    }

    const existing = this.store.get(trimmed);
    let state: SessionState;
    if (!existing || now - existing.updatedAt > this.ttlMs) {
      state = { messages: [], updatedAt: now };
      this.store.set(trimmed, state);
    } else {
      state = existing;
      state.updatedAt = now;
    }

    return { id: trimmed, priorMessages: [...state.messages] };
  }

  commitTurn(conversationId: string, userText: string, modelText: string): void {
    let state = this.store.get(conversationId);
    if (!state) {
      state = { messages: [], updatedAt: Date.now() };
      this.store.set(conversationId, state);
    }
    state.updatedAt = Date.now();
    state.messages.push({ role: 'user', text: userText });
    state.messages.push({ role: 'model', text: modelText });
    this.trim(state.messages);
  }

  private trim(messages: RagConvMessage[]): void {
    const maxMessages = Math.max(
      2,
      Number.isFinite(this.rag.conversationMaxMessages)
        ? this.rag.conversationMaxMessages
        : 20,
    );
    while (messages.length > maxMessages) {
      messages.shift();
    }
    while (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift();
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [id, s] of this.store) {
      if (now - s.updatedAt > this.ttlMs) {
        this.store.delete(id);
      }
    }
  }
}
