import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { loadGeminiConfig } from './gemini.config';

export type ConversationRole = 'user' | 'model';

export interface ConversationMessage {
  role: ConversationRole;
  text: string;
}

interface SessionState {
  messages: ConversationMessage[];
  updatedAt: number;
}

@Injectable()
export class AiConversationService {
  private readonly store = new Map<string, SessionState>();
  private readonly ttlMs: number;
  private readonly maxMessages: number;

  constructor() {
    const c = loadGeminiConfig();
    this.ttlMs = Math.max(1000, c.aiConversationTtlSec * 1000);
    this.maxMessages = Math.max(2, c.aiConversationMaxMessages);
  }

  beginTurn(incomingSessionId?: string): {
    sessionId: string;
    messages: ConversationMessage[];
  } {
    this.evictExpired();
    const trimmed = incomingSessionId?.trim();
    const now = Date.now();

    if (!trimmed) {
      const sessionId = randomUUID();
      const state: SessionState = { messages: [], updatedAt: now };
      this.store.set(sessionId, state);
      return { sessionId, messages: state.messages };
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

    return { sessionId: trimmed, messages: state.messages };
  }

  normalizeAfterUserMessage(sessionId: string): void {
    const state = this.store.get(sessionId);
    if (!state) {
      return;
    }
    this.trim(state.messages);
    state.updatedAt = Date.now();
  }

  appendModelReply(sessionId: string, text: string): void {
    const state = this.store.get(sessionId);
    if (!state) {
      return;
    }
    state.messages.push({ role: 'model', text });
    state.updatedAt = Date.now();
    this.trim(state.messages);
  }

  private trim(messages: ConversationMessage[]): void {
    while (messages.length > this.maxMessages) {
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
