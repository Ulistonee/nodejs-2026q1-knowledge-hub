import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { resolve } from 'node:path';
import { FileRotator } from './file-rotator';
import { redactSensitive, redactString } from './redact';

const ALL_LEVELS: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

function levelsAtAndAbove(level: LogLevel): LogLevel[] {
  const idx = ALL_LEVELS.indexOf(level);
  if (idx === -1) return ['log', 'error', 'warn'];
  return ALL_LEVELS.slice(0, idx + 1);
}

function resolveLogLevels(): LogLevel[] {
  const env = (process.env.LOG_LEVEL ?? 'log').toLowerCase();
  const allowed: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];
  const level = (allowed as string[]).includes(env) ? (env as LogLevel) : 'log';
  return levelsAtAndAbove(level);
}

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? 'development').toLowerCase() === 'production';
}

function defaultFilePath(): string {
  const dir = process.env.LOG_DIR ?? 'logs';
  return resolve(process.cwd(), dir, 'app.log');
}

function defaultMaxBytes(): number {
  const kb = Number(process.env.LOG_MAX_FILE_SIZE);
  const safeKb = Number.isFinite(kb) && kb > 0 ? kb : 1024;
  return Math.floor(safeKb * 1024);
}

interface StructuredEntry {
  timestamp: string;
  level: LogLevel | 'fatal';
  context?: string;
  message: unknown;
  trace?: string;
  pid: number;
}

@Injectable()
export class AppLogger extends ConsoleLogger {
  private readonly fileRotator: FileRotator | null;
  private readonly structured: boolean;

  constructor() {
    super();
    super.setLogLevels(resolveLogLevels());
    this.structured = isProduction();
    this.fileRotator = new FileRotator({
      filePath: defaultFilePath(),
      maxSizeBytes: defaultMaxBytes(),
    });
  }

  log(message: unknown, context?: string): void {
    const sanitized = this.sanitize(message);
    if (context !== undefined) super.log(sanitized as never, context);
    else super.log(sanitized as never);
    void this.persist('log', sanitized, context);
  }

  warn(message: unknown, context?: string): void {
    const sanitized = this.sanitize(message);
    if (context !== undefined) super.warn(sanitized as never, context);
    else super.warn(sanitized as never);
    void this.persist('warn', sanitized, context);
  }

  debug(message: unknown, context?: string): void {
    const sanitized = this.sanitize(message);
    if (context !== undefined) super.debug(sanitized as never, context);
    else super.debug(sanitized as never);
    void this.persist('debug', sanitized, context);
  }

  verbose(message: unknown, context?: string): void {
    const sanitized = this.sanitize(message);
    if (context !== undefined) super.verbose(sanitized as never, context);
    else super.verbose(sanitized as never);
    void this.persist('verbose', sanitized, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    const sanitized = this.sanitize(message);
    if (trace !== undefined && context !== undefined) {
      super.error(sanitized as never, trace, context);
    } else if (trace !== undefined) {
      super.error(sanitized as never, trace);
    } else {
      super.error(sanitized as never);
    }
    void this.persist('error', sanitized, context, trace);
  }

  fatal(message: unknown, trace?: string, context?: string): void {
    const sanitized = this.sanitize(message);
    if (context !== undefined) super.fatal(sanitized as never, context);
    else super.fatal(sanitized as never);
    void this.persist('fatal', sanitized, context, trace);
  }

  private sanitize(message: unknown): unknown {
    if (message === null || message === undefined) return message;
    if (typeof message === 'string') return redactString(message);
    if (typeof message === 'object') return redactSensitive(message);
    return message;
  }

  private async persist(
    level: LogLevel | 'fatal',
    message: unknown,
    context?: string,
    trace?: string,
  ): Promise<void> {
    if (!this.fileRotator) return;
    const entry: StructuredEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      trace: trace ? redactString(String(trace)) : undefined,
      pid: process.pid,
    };
    const line = this.structured
      ? safeJson(entry)
      : `[${entry.timestamp}] [${level.toUpperCase()}]${context ? ' [' + context + ']' : ''} ${typeof message === 'string' ? message : safeJson(message)}${trace ? '\n' + redactString(String(trace)) : ''}`;
    await this.fileRotator.append(line);
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: '[unserializable log payload]' });
  }
}
