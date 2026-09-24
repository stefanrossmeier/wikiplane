import { copyFile, mkdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type {
  AcquiredArtifact,
  ConvertedSource,
  DocumentConverter,
  WebConverter,
} from '@wikiplane/application';

export class MarkdownConverter implements DocumentConverter {
  readonly name = 'markdown';

  supports(artifact: AcquiredArtifact): boolean {
    const ext = extname(artifact.filename).toLowerCase();
    return artifact.mediaType === 'text/markdown' || artifact.mediaType === 'text/plain' || ['.md', '.markdown', '.txt'].includes(ext);
  }

  async convert(artifact: AcquiredArtifact, outputDir: string): Promise<ConvertedSource> {
    await mkdir(outputDir, { recursive: true });
    const output = join(outputDir, `${basename(artifact.filename, extname(artifact.filename)) || 'source'}.md`);
    if (artifact.localPath !== output) await copyFile(artifact.localPath, output);
    return {
      markdownPath: output,
      title: basename(artifact.filename, extname(artifact.filename)).replace(/[-_]+/g, ' '),
      adapter: this.name,
      adapterVersion: '1',
      diagnostics: { source_media_type: artifact.mediaType },
    };
  }
}

export interface MarkItDownClientOptions {
  endpoint: string;
  timeoutMs?: number;
  useOcr?: boolean;
}

export class MarkItDownConverter implements DocumentConverter, WebConverter {
  readonly name = 'markitdown';

  constructor(private readonly options: MarkItDownClientOptions) {}

  supports(artifact: AcquiredArtifact): boolean {
    const ext = extname(artifact.filename).toLowerCase();
    return !['.md', '.markdown', '.txt'].includes(ext) && artifact.mediaType !== 'text/markdown' && artifact.mediaType !== 'text/plain';
  }

  async convert(artifact: AcquiredArtifact, outputDir: string): Promise<ConvertedSource> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 120_000);
    try {
      const response = await fetch(`${this.options.endpoint.replace(/\/$/, '')}/convert`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          input_path: artifact.localPath,
          output_dir: outputDir,
          use_ocr: this.options.useOcr ?? true,
        }),
      });
      if (!response.ok) throw new Error(`MarkItDown service failed: ${response.status} ${await response.text()}`);
      const result = (await response.json()) as Record<string, unknown>;
      if (typeof result.markdown_path !== 'string') throw new Error('MarkItDown service response missing markdown_path');
      return {
        markdownPath: result.markdown_path,
        title: typeof result.title === 'string' ? result.title : basename(artifact.filename, extname(artifact.filename)),
        adapter: this.name,
        adapterVersion: typeof result.version === 'string' ? result.version : undefined,
        diagnostics: typeof result.diagnostics === 'object' && result.diagnostics ? result.diagnostics as Record<string, unknown> : undefined,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
