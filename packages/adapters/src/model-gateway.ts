import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelRole,
  OcrProvider,
  OcrRequest,
  OcrResult,
} from '@wikiplane/application';

export interface GatewayModelProviderOptions {
  endpoint: string;
  roles: Record<ModelRole, string | undefined>;
  apiKey?: string;
}

export class GatewayModelProvider implements ModelProvider {
  constructor(private readonly options: GatewayModelProviderOptions) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const model = this.options.roles[request.role];
    if (!model) throw new Error(`No model alias configured for role: ${request.role}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 120_000);
    try {
      const response = await fetch(`${this.options.endpoint.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey ?? 'wikiplane-internal'}`,
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          response_format: request.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
          metadata: request.metadata,
        }),
      });
      if (!response.ok) throw new Error(`Model gateway failed: ${response.status} ${await response.text()}`);
      const data = (await response.json()) as any;
      const choice = data.choices?.[0];
      return {
        content: String(choice?.message?.content ?? ''),
        model: typeof data.actual_model === 'string' ? data.actual_model : typeof data.model === 'string' ? data.model : model,
        provider: typeof data.provider === 'string' ? data.provider : undefined,
        usage: data.usage && typeof data.usage === 'object' ? data.usage : undefined,
        finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : undefined,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export class GatewayOcrProvider implements OcrProvider {
  constructor(private readonly options: { endpoint: string; model: string; apiKey?: string; timeoutMs?: number }) {}

  async transcribe(request: OcrRequest): Promise<OcrResult> {
    const bytes = await readFile(request.imagePath);
    const mime = imageMime(extname(request.imagePath));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 120_000);
    try {
      const response = await fetch(`${this.options.endpoint.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey ?? 'wikiplane-internal'}`,
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: request.prompt ?? 'Transcribe all visible text faithfully. Preserve reading order and table structure.' },
                { type: 'image_url', image_url: { url: `data:${mime};base64,${bytes.toString('base64')}` } },
              ],
            },
          ],
        }),
      });
      if (!response.ok) throw new Error(`OCR gateway failed: ${response.status} ${await response.text()}`);
      const data = (await response.json()) as any;
      return {
        text: String(data.choices?.[0]?.message?.content ?? ''),
        model: typeof data.actual_model === 'string' ? data.actual_model : typeof data.model === 'string' ? data.model : this.options.model,
        usage: data.usage && typeof data.usage === 'object' ? data.usage : undefined,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function imageMime(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    default: return 'image/png';
  }
}
