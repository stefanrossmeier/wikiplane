import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { AcquiredArtifact, AcquireRequest, SourceAcquirer } from '@wikiplane/application';

export interface HttpSourceAcquirerOptions {
  maxBytes: number;
  timeoutMs: number;
  redirectLimit: number;
}

export class SafeSourceAcquirer implements SourceAcquirer {
  constructor(private readonly options: HttpSourceAcquirerOptions) {}

  async acquire(request: AcquireRequest): Promise<AcquiredArtifact> {
    await mkdir(request.workspaceDir, { recursive: true });
    if (!/^https?:\/\//i.test(request.source)) return this.acquireLocal(request);
    return this.acquireRemote(request);
  }

  private async acquireLocal(request: AcquireRequest): Promise<AcquiredArtifact> {
    const sourcePath = resolve(request.source);
    const filename = sanitizeFilename(basename(sourcePath) || 'source');
    const destination = resolve(request.workspaceDir, filename);
    await copyFile(sourcePath, destination);
    return {
      kind: 'local',
      suppliedReference: request.source,
      resolvedReference: sourcePath,
      localPath: destination,
      filename,
      mediaType: mediaTypeFromExtension(filename),
    };
  }

  private async acquireRemote(request: AcquireRequest): Promise<AcquiredArtifact> {
    let url = new URL(request.source);
    const suppliedReference = request.source;
    let response: Response | undefined;
    for (let redirect = 0; redirect <= this.options.redirectLimit; redirect += 1) {
      await assertSafeRemoteUrl(url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
      try {
        response = await fetch(url, {
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'user-agent': 'Wikiplane/0.1 (+https://github.com/stefanrossmeier/wikiplane)' },
        });
      } finally {
        clearTimeout(timer);
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`Redirect ${response.status} did not include Location`);
        if (redirect === this.options.redirectLimit) throw new Error('Redirect limit exceeded');
        url = new URL(location, url);
        continue;
      }
      break;
    }
    if (!response) throw new Error('Acquisition failed before receiving a response');
    if (!response.ok) throw new Error(`HTTP acquisition failed: ${response.status} ${response.statusText}`);
    const contentLength = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > this.options.maxBytes) {
      throw new Error(`Remote source exceeds configured maximum of ${this.options.maxBytes} bytes`);
    }
    const mediaType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (mediaType && !isAllowedMediaType(mediaType)) {
      await response.body?.cancel('Unsupported Wikiplane content type').catch(() => undefined);
      throw new Error(`Unsupported remote content type: ${mediaType}`);
    }
    const data = await readLimitedBody(response, this.options.maxBytes, this.options.timeoutMs);
    const filename = filenameForUrl(url, mediaType);
    const destination = resolve(request.workspaceDir, filename);
    await writeFile(destination, data);
    return {
      kind: 'remote',
      suppliedReference,
      resolvedReference: url.toString(),
      localPath: destination,
      filename,
      mediaType,
      byteLength: data.byteLength,
    };
  }
}

async function readLimitedBody(response: Response, maxBytes: number, timeoutMs: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  const deadline = Date.now() + timeoutMs;
  let total = 0;
  try {
    while (true) {
      const { done, value } = await readWithTimeout(reader, Math.max(1, deadline - Date.now()));
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('Wikiplane response size limit exceeded').catch(() => undefined);
        throw new Error(`Remote source exceeds configured maximum of ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Remote source body timed out after ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } catch (error) {
    await reader.cancel('Wikiplane acquisition timeout').catch(() => undefined);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function assertSafeRemoteUrl(url: URL): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsupported URL scheme: ${url.protocol}`);
  if (url.username || url.password) throw new Error('Credentials in source URLs are not allowed');
  const hostname = url.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('Localhost targets are blocked');
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error(`Could not resolve source host: ${hostname}`);
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) throw new Error(`Private/local network target is blocked: ${address}`);
  }
}

function isPrivateAddress(address: string): boolean {
  if (address.includes(':')) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized === '::' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd');
  }
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value))) return true;
  const [a = 0, b = 0] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}
function isAllowedMediaType(value: string): boolean {
  if (value.startsWith('text/')) return true;
  if (value.startsWith('image/')) return true;
  return new Set([
    'application/pdf',
    'application/json',
    'application/ld+json',
    'application/xml',
    'application/xhtml+xml',
    'application/octet-stream',
    'application/zip',
    'application/epub+zip',
    'application/rtf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]).has(value);
}

function filenameForUrl(url: URL, mediaType?: string): string {
  let name = sanitizeFilename(basename(url.pathname) || 'source');
  if (!extname(name)) name += extensionForMediaType(mediaType);
  return name;
}
function sanitizeFilename(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return sanitized.slice(0, 180) || 'source';
}
function extensionForMediaType(value?: string): string {
  if (value === 'application/pdf') return '.pdf';
  if (value === 'text/html' || value === 'application/xhtml+xml') return '.html';
  if (value === 'text/markdown') return '.md';
  if (value?.startsWith('text/')) return '.txt';
  return '.bin';
}
function mediaTypeFromExtension(name: string): string | undefined {
  const ext = extname(name).toLowerCase();
  if (['.md', '.markdown'].includes(ext)) return 'text/markdown';
  if (ext === '.pdf') return 'application/pdf';
  if (['.html', '.htm'].includes(ext)) return 'text/html';
  if (['.txt', '.text'].includes(ext)) return 'text/plain';
  return undefined;
}
