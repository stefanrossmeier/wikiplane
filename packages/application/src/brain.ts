import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { initWiki } from '@wikiplane/core';

export const DEFAULT_AGENTS_TEMPLATE = `# AGENTS.md

This repository is a Wikiplane brain. It stores knowledge, not application code.

## Durable layout

- \`raw/\` contains canonical Markdown transcriptions of source material.
- \`wiki/sources/\` contains source records and provenance.
- \`wiki/concepts/\` contains durable concepts.
- \`wiki/entities/\` contains named entities.
- \`wiki/index.md\` is deterministic derived navigation.
- \`wiki/log.md\` is the human-readable operation log.

## Ontology

The v1 page types are \`source\`, \`concept\`, and \`entity\`.
Every wiki knowledge page has \`id\`, \`type\`, and \`title\` frontmatter.

## Source identity and provenance

Remote source identity uses the exact supplied source reference. Content hashes are not source identity. Keep exact deep links in source frontmatter. Different URLs are distinct source records unless a future migration says otherwise.

## Contradictions

Preserve material disagreements with provenance. Do not silently overwrite one legitimate source with another.

## Links and generated state

Use relative Markdown links. Prefer precise authored forward links. Backlinks are derived. \`wiki/index.md\` is rebuildable and must contain no unique knowledge.
`;

/**
 * Ensure the storage-only brain layout exists without mutating an existing schema.
 * AGENTS.md is instantiated only for a new/missing brain; schema upgrades belong to an
 * explicit migration rather than ordinary ingestion.
 */
export async function initializeBrain(
  brainRoot: string,
  agentsTemplate = DEFAULT_AGENTS_TEMPLATE,
): Promise<void> {
  await mkdir(brainRoot, { recursive: true });
  await initWiki(brainRoot);
  await Promise.all([
    mkdir(join(brainRoot, 'raw'), { recursive: true }),
    mkdir(join(brainRoot, 'wiki', 'sources'), { recursive: true }),
    mkdir(join(brainRoot, 'wiki', 'concepts'), { recursive: true }),
    mkdir(join(brainRoot, 'wiki', 'entities'), { recursive: true }),
  ]);
  await ensureTextFile(join(brainRoot, 'AGENTS.md'), agentsTemplate.trim() + '\n');
  await ensureReadme(brainRoot);
}

async function ensureReadme(brainRoot: string): Promise<void> {
  await ensureTextFile(
    join(brainRoot, 'README.md'),
    `# Wikiplane Brain

This repository is storage managed by Wikiplane.

- [Wiki index](wiki/index.md)
- [Concepts](wiki/concepts/)
- [Entities](wiki/entities/)
- [Sources](wiki/sources/)
- [Raw source transcriptions](raw/)
- [Operation log](wiki/log.md)

The repository intentionally contains no Wikiplane runtime code, credentials, Docker configuration, or original remote binaries.
`,
  );
}

async function ensureTextFile(path: string, content: string): Promise<void> {
  try {
    const existing = await readFile(path, 'utf8');
    if (existing.trim()) return;
  } catch {
    // Create below.
  }
  await writeFile(path, content, 'utf8');
}
