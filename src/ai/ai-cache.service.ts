import { Injectable } from '@nestjs/common';
import { loadGeminiConfig } from './gemini.config';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class AiCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;
  private hits = 0;
  private misses = 0;

  constructor() {
    this.ttlMs = loadGeminiConfig().aiCacheTtlSec * 1000;
  }

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key) as CacheEntry<T> | undefined;
    if (!hit) {
      this.misses += 1;
      return undefined;
    }
    if (Date.now() >= hit.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    return hit.value;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  cacheKeyParts(parts: string[]): string {
    return parts.join(':');
  }

  getStats(): {
    hits: number;
    misses: number;
    hitRatio: number | null;
  } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? this.hits / total : null,
    };
  }
}
