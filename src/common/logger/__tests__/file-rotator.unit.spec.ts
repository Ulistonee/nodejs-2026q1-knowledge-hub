import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileRotator } from '../file-rotator';

describe('FileRotator (unit)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rotator-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the log file and writes lines', async () => {
    const rotator = new FileRotator({
      filePath: join(dir, 'app.log'),
      maxSizeBytes: 1024 * 1024,
    });
    await rotator.append('first');
    await rotator.append('second');
    const content = readFileSync(join(dir, 'app.log'), 'utf8');
    expect(content).toBe('first\nsecond\n');
  });

  it('rotates when file size would exceed the limit', async () => {
    const rotator = new FileRotator({
      filePath: join(dir, 'app.log'),
      maxSizeBytes: 1024,
    });

    const big = 'X'.repeat(800);
    await rotator.append(big);
    await rotator.append(big);
    await rotator.append(big);

    const files = readdirSync(dir).sort();
    const rotated = files.filter((f) => f !== 'app.log');
    expect(rotated.length).toBeGreaterThanOrEqual(1);
    expect(rotated[0]).toMatch(/^app-.*\.log$/);
  });

  it('enforces minimum max size of 1KB even when given smaller value', async () => {
    const rotator = new FileRotator({
      filePath: join(dir, 'small.log'),
      maxSizeBytes: 50,
    });
    await rotator.append('x'.repeat(40));
    await rotator.append('y'.repeat(40));
    expect(readFileSync(join(dir, 'small.log'), 'utf8').length).toBeGreaterThan(
      0,
    );
  });

  it('disables itself silently when the log directory cannot be created', async () => {
    const blockingFile = join(dir, 'not-a-dir');
    writeFileSync(blockingFile, 'reserved');
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    const rotator = new FileRotator({
      filePath: join(blockingFile, 'sub', 'app.log'),
      maxSizeBytes: 1024,
    });

    expect(rotator.isDisabled()).toBe(true);
    expect(rotator.getDisabledReason()).toBeTruthy();
    await expect(rotator.append('still works')).resolves.toBeUndefined();
    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });
});
