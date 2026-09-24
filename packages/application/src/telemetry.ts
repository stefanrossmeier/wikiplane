import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export class OperationTelemetry {
  private readonly path: string;

  constructor(root: string, readonly operationId: string) {
    this.path = join(root, 'telemetry', `${operationId}.jsonl`);
  }

  async event(event: string, data: Record<string, unknown> = {}): Promise<void> {
    await mkdir(join(this.path, '..'), { recursive: true });
    await appendFile(
      this.path,
      `${JSON.stringify({ ts: new Date().toISOString(), operation_id: this.operationId, event, ...data })}\n`,
      'utf8',
    );
  }

  async stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const started = performance.now();
    await this.event(`${name}_started`);
    try {
      const result = await fn();
      await this.event(`${name}_completed`, { duration_ms: Math.round(performance.now() - started) });
      return result;
    } catch (error) {
      await this.event(`${name}_failed`, {
        duration_ms: Math.round(performance.now() - started),
        error_type: error instanceof Error ? error.name : typeof error,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
