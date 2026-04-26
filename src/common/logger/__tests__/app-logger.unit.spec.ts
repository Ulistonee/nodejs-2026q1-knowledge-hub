import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function flush(ms = 100): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('AppLogger (unit)', () => {
  let dir: string;
  let originals: Record<string, string | undefined>;

  beforeEach(() => {
    originals = {
      LOG_DIR: process.env.LOG_DIR,
      LOG_LEVEL: process.env.LOG_LEVEL,
      LOG_MAX_FILE_SIZE: process.env.LOG_MAX_FILE_SIZE,
      NODE_ENV: process.env.NODE_ENV,
    };
    dir = mkdtempSync(join(tmpdir(), 'app-logger-'));
    process.env.LOG_DIR = dir;
    process.env.LOG_LEVEL = 'verbose';
    process.env.LOG_MAX_FILE_SIZE = '8';
    process.env.NODE_ENV = 'production';
    vi.resetModules();
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(originals)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes a structured JSON line in production mode', async () => {
    const { AppLogger } = await import('../app-logger.service');
    const logger = new AppLogger();
    logger.log('hello', 'TestContext');
    await flush();
    const content = readFileSync(join(dir, 'app.log'), 'utf8').trim();
    const parsed = JSON.parse(content.split('\n').pop() as string);
    expect(parsed.level).toBe('log');
    expect(parsed.message).toBe('hello');
    expect(parsed.context).toBe('TestContext');
    expect(parsed.timestamp).toEqual(expect.any(String));
    expect(parsed.pid).toBe(process.pid);
  });

  it('redacts password and token values in object payloads', async () => {
    const { AppLogger } = await import('../app-logger.service');
    const logger = new AppLogger();
    logger.log({ login: 'alice', password: 'plain123', token: 'abc' });
    await flush();
    const content = readFileSync(join(dir, 'app.log'), 'utf8');
    expect(content).not.toContain('plain123');
    expect(content).not.toContain('abc');
    expect(content).toContain('[REDACTED]');
  });

  it('redacts password values inside string messages', async () => {
    const { AppLogger } = await import('../app-logger.service');
    const logger = new AppLogger();
    logger.log('{"login":"alice","password":"super-secret"}');
    await flush();
    const content = readFileSync(join(dir, 'app.log'), 'utf8');
    expect(content).not.toContain('super-secret');
    expect(content).toContain('[REDACTED]');
  });

  it('rotates the file when its size exceeds LOG_MAX_FILE_SIZE', async () => {
    process.env.LOG_MAX_FILE_SIZE = '1';
    vi.resetModules();
    const { AppLogger } = await import('../app-logger.service');
    const logger = new AppLogger();
    for (let i = 0; i < 30; i += 1) {
      logger.log(`message-${i}-${'x'.repeat(80)}`);
    }
    await flush(300);
    const files = readdirSync(dir);
    const rotated = files.filter(
      (f) => f.startsWith('app-') && f.endsWith('.log'),
    );
    expect(rotated.length).toBeGreaterThan(0);
  });
});
