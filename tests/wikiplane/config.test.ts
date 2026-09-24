import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../packages/application/src/config.js';

const valid = {
  brain: { remote: './brain', branch: 'main', workspace_root: './workspaces' },
  git: { author_name: 'Wikiplane', author_email: 'wikiplane@example.invalid', push: false },
  adapters: { document: 'markitdown', web: 'markitdown', ocr: 'markitdown-ocr' },
  models: {
    endpoint: 'http://localhost:8000/v1',
    roles: { integrate: 'integrate', crosslink: 'crosslink', query: 'query', ocr: 'ocr' },
  },
  ingest: { preserve_supplied_source_reference: true, retain_original_artifact: false },
  logging: { level: 'info', retain_prompt_bodies: false, retain_document_bodies: false },
};

describe('config', () => {
  it('validates and resolves filesystem paths', () => {
    const config = parseConfig(valid, '/tmp/config-root');
    expect(config.brain.remote).toBe('/tmp/config-root/brain');
    expect(config.brain.workspace_root).toBe('/tmp/config-root/workspaces');
  });

  it('rejects unknown concrete adapter selections before ingestion', () => {
    expect(() => parseConfig({ ...valid, adapters: { ...valid.adapters, web: 'unconfigured-vendor' } })).toThrow();
  });

  it('rejects weakening exact provenance preservation', () => {
    expect(() => parseConfig({ ...valid, ingest: { ...valid.ingest, preserve_supplied_source_reference: false } })).toThrow();
  });

  it('rejects unsupported artifact/body retention settings instead of silently ignoring them', () => {
    expect(() => parseConfig({ ...valid, ingest: { ...valid.ingest, retain_original_artifact: true } })).toThrow();
    expect(() => parseConfig({ ...valid, logging: { ...valid.logging, retain_prompt_bodies: true } })).toThrow();
    expect(() => parseConfig({ ...valid, logging: { ...valid.logging, retain_document_bodies: true } })).toThrow();
  });
});
