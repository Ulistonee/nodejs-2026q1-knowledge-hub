import { existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { appendFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface FileRotatorOptions {
  filePath: string;
  maxSizeBytes: number;
}

export class FileRotator {
  private readonly filePath: string;
  private readonly maxSizeBytes: number;
  private writeChain: Promise<void> = Promise.resolve();
  private disabled = false;
  private readonly disabledReason: string | null;

  constructor(options: FileRotatorOptions) {
    this.filePath = options.filePath;
    this.maxSizeBytes = Math.max(1024, options.maxSizeBytes);

    const dir = dirname(this.filePath);
    let reason: string | null = null;
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    } catch (error) {
      this.disabled = true;
      reason = error instanceof Error ? error.message : String(error);
      // surface a one-time notice on stderr so disappearing file logs are debuggable
      process.stderr.write(
        `[FileRotator] disabled: cannot prepare log directory "${dir}" (${reason})\n`,
      );
    }
    this.disabledReason = reason;
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  getDisabledReason(): string | null {
    return this.disabledReason;
  }

  async append(line: string): Promise<void> {
    if (this.disabled) return;
    const next = this.writeChain.then(() => this.write(line)).catch(() => undefined);
    this.writeChain = next;
    return next;
  }

  private async write(line: string): Promise<void> {
    const data = line.endsWith('\n') ? line : `${line}\n`;
    const dataBytes = Buffer.byteLength(data, 'utf8');

    let currentSize = 0;
    try {
      const info = await stat(this.filePath);
      currentSize = info.size;
    } catch {
      currentSize = 0;
    }

    if (currentSize > 0 && currentSize + dataBytes > this.maxSizeBytes) {
      this.rotateSync();
    }

    try {
      await appendFile(this.filePath, data, { encoding: 'utf8' });
    } catch {
      // intentionally swallow file write errors so logging never crashes the app
    }
  }

  private rotateSync(): void {
    try {
      if (!existsSync(this.filePath)) return;
      const info = statSync(this.filePath);
      if (info.size === 0) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dir = dirname(this.filePath);
      const base = this.filePath.split('/').pop() ?? 'app.log';
      const dotIdx = base.lastIndexOf('.');
      const name = dotIdx === -1 ? base : base.slice(0, dotIdx);
      const ext = dotIdx === -1 ? '' : base.slice(dotIdx);
      const rotated = join(dir, `${name}-${stamp}${ext}`);
      renameSync(this.filePath, rotated);
    } catch {
      // intentionally swallow rotation errors
    }
  }
}
