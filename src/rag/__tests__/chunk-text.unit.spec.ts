import { describe, expect, it } from 'vitest';
import { chunkTextDeterministic, normalizeChunkParams } from '../chunk-text';

describe('chunkTextDeterministic', () => {
  it('returns empty array for empty string', () => {
    expect(chunkTextDeterministic('', 800, 200)).toEqual([]);
  });

  it('returns single chunk when text is shorter than chunk size', () => {
    expect(chunkTextDeterministic('hello', 800, 200)).toEqual(['hello']);
  });

  it('returns one chunk exactly at boundary length', () => {
    const text = 'a'.repeat(800);
    expect(chunkTextDeterministic(text, 800, 200)).toEqual([text]);
  });

  it('slides with overlap: size 10, overlap 4 → stride 6', () => {
    const text = '0123456789abcdefghij';
    expect(chunkTextDeterministic(text, 10, 4)).toEqual([
      '0123456789',
      '6789abcdef',
      'cdefghij',
    ]);
  });

  it('overlap 0: non-overlapping windows', () => {
    expect(chunkTextDeterministic('0123456789', 4, 0)).toEqual([
      '0123',
      '4567',
      '89',
    ]);
  });

  it('is deterministic for same inputs', () => {
    const t = 'x'.repeat(2500);
    const a = chunkTextDeterministic(t, 800, 200);
    const b = chunkTextDeterministic(t, 800, 200);
    expect(a).toEqual(b);
  });
});

describe('normalizeChunkParams', () => {
  it('caps overlap below chunk size', () => {
    const p = normalizeChunkParams(100, 150);
    expect(p.overlap).toBe(99);
    expect(p.stride).toBe(1);
  });
});
