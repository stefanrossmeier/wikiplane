import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeBrain, rebuildBrain } from '../../packages/application/src/index.js';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('brain lifecycle', () => {
  it('initializes the data-only layout at repository root, not .wiki/', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wikiplane-brain-'));
    dirs.push(root);
    await initializeBrain(root);
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toContain('Wikiplane brain');
    expect(await readFile(join(root, 'wiki', 'index.md'), 'utf8')).toContain('# Wiki Index');
    expect(await readFile(join(root, 'README.md'), 'utf8')).toContain('[Raw source transcriptions](raw/)');
    await expect(readFile(join(root, '.wiki', 'AGENTS.md'), 'utf8')).rejects.toThrow();
  });

  it('does not silently overwrite an existing AGENTS.md schema during ordinary initialization', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wikiplane-schema-'));
    dirs.push(root);
    await initializeBrain(root);
    await writeFile(join(root, 'AGENTS.md'), '# Custom migrated schema\n', 'utf8');
    await initializeBrain(root);
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toBe('# Custom migrated schema\n');
  });

  it('rebuild is deterministic and detects stale derived state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wikiplane-rebuild-'));
    dirs.push(root);
    await initializeBrain(root);
    const first = await rebuildBrain(root);
    expect(first.errors).toBe(0);
    const second = await rebuildBrain(root, true);
    expect(second.changed).toBe(false);
    expect(second.errors).toBe(0);
  });
});
