import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPage, writePage } from '../../packages/core/src/wiki.js';
import {
  findSourceById,
  initializeBrain,
  KnowledgeCompiler,
  rebuildBrain,
  type StoredSource,
} from '../../packages/application/src/index.js';
import { ScriptedModelProvider } from '../../packages/testing/src/index.js';

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));

async function brain(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'wikiplane-security-'));
  dirs.push(root);
  await initializeBrain(root);
  return root;
}

describe('brain trust boundary', () => {
  it('rejects raw source paths that escape raw/', async () => {
    const root = await brain();
    await writePage(join(root, 'wiki', 'sources', 'src_bad.md'), {
      frontmatter: {
        id: 'src_bad',
        type: 'source',
        title: 'Bad source',
        source_url: 'https://example.invalid/bad',
        source_path: 'raw/../../outside.md',
      },
      body: '# Bad source',
    });

    const result = await rebuildBrain(root, true);
    expect(result.findings.some((finding) => finding.category === 'provenance' && finding.message.includes('escapes raw/'))).toBe(true);
  });

  it('rejects source page filename/id mismatches before using source metadata', async () => {
    const root = await brain();
    await writePage(join(root, 'wiki', 'sources', 'src_one.md'), {
      frontmatter: {
        id: 'src_two',
        type: 'source',
        title: 'Mismatched source',
        source_url: 'https://example.invalid/source',
        source_path: 'raw/src_two.md',
      },
      body: '# Mismatched source',
    });
    await expect(findSourceById(root, 'src_one')).rejects.toThrow(/mismatched id/i);
  });

  it('sanitizes model-authored Markdown before deterministic filesystem writes', async () => {
    const root = await brain();
    const source: StoredSource = {
      id: 'src_safe',
      title: 'Source',
      suppliedReference: 'https://example.invalid/source',
      rawPath: 'raw/src_safe.md',
      sourcePagePath: 'sources/src_safe.md',
      retrievedAt: '2026-09-24T00:00:00Z',
      adapter: 'test',
    };
    await writePage(join(root, 'wiki', source.sourcePagePath), {
      frontmatter: {
        id: source.id,
        type: 'source',
        title: source.title,
        source_url: source.suppliedReference,
        source_path: source.rawPath,
      },
      body: '# Source',
    });
    await writePage(join(root, source.rawPath), {
      frontmatter: { id: source.id, type: 'source-transcription', title: source.title },
      body: 'content',
    });

    const model = new ScriptedModelProvider({
      integrate: JSON.stringify({
        knowledge: [{
          page_type: 'concept',
          title: '[Injected](https://attacker.invalid)',
          summary: '<script>summary</script>',
          tags: [],
          claims: ['[click](javascript:alert(1)) <img src=x>'],
        }],
        contradictions: [],
      }),
      crosslink: JSON.stringify({ links: [] }),
    });
    const compiler = new KnowledgeCompiler(model);
    const result = await compiler.integrate({ brainRoot: root, source, markdown: 'content' });
    expect(result.created).toHaveLength(1);
    const page = await readPage(join(root, 'wiki', result.created[0]!));
    expect(page.frontmatter.title).not.toContain('[');
    expect(page.frontmatter.summary).not.toContain('<');
    expect(page.body).toContain('\\[click\\](javascript:alert(1))');
    expect(page.body).toContain('&lt;img src=x&gt;');
  });

  it('rejects model mutations whose sanitized title is empty', async () => {
    const root = await brain();
    const source: StoredSource = {
      id: 'src_safe', title: 'Source', suppliedReference: 'local', rawPath: 'raw/src_safe.md',
      sourcePagePath: 'sources/src_safe.md', retrievedAt: '', adapter: 'test',
    };
    const model = new ScriptedModelProvider({
      integrate: JSON.stringify({
        knowledge: [{ page_type: 'concept', title: '[]<>', summary: '', tags: [], claims: ['claim'] }],
        contradictions: [],
      }),
    });
    await expect(new KnowledgeCompiler(model).integrate({ brainRoot: root, source, markdown: 'content' })).rejects.toThrow(/title became empty/i);
  });
});
