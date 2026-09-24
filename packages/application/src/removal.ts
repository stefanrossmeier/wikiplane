import { join, relative, resolve, dirname } from 'node:path';
import { unlink } from 'node:fs/promises';
import {
  deletePage,
  getPageLinksDetailed,
  listPages,
  readPage,
  writePage,
} from '@wikiplane/core';
import { findSourceById } from './source-store.js';
import { removeSourceBlocks } from './compiler.js';

export interface RemoveSourceResult {
  sourceId: string;
  pagesDeleted: string[];
  pagesUpdated: string[];
}

export async function removeSourceFromBrain(
  brainRoot: string,
  sourceId: string,
): Promise<RemoveSourceResult> {
  const source = await findSourceById(brainRoot, sourceId);
  if (!source) throw new Error(`Source not found: ${sourceId}`);
  const wikiDir = join(brainRoot, 'wiki');
  const pagesDeleted: string[] = [];
  const pagesUpdated: string[] = [];

  for (const path of (await listPages(wikiDir)).filter((value) => {
    const rel = relative(wikiDir, value).replace(/\\/g, '/');
    return rel.startsWith('concepts/') || rel.startsWith('entities/');
  })) {
    const page = await readPage(path);
    const sources = Array.isArray(page.frontmatter.sources)
      ? page.frontmatter.sources.filter((value): value is string => typeof value === 'string')
      : [];
    if (!sources.includes(sourceId)) continue;
    const remaining = sources.filter((value) => value !== sourceId);
    const rel = relative(wikiDir, path).replace(/\\/g, '/');
    if (remaining.length === 0) {
      await deletePage(wikiDir, rel);
      await removeLinksTo(wikiDir, rel);
      pagesDeleted.push(rel);
      continue;
    }
    page.frontmatter.sources = remaining;
    page.frontmatter.updated = new Date().toISOString();
    page.body = removeSourceBlocks(page.body, sourceId);
    page.frontmatter.summary = supportedSummary(page.body, remaining.length);
    await writePage(path, page);
    pagesUpdated.push(rel);
  }

  await deletePage(wikiDir, source.sourcePagePath);
  await removeLinksTo(wikiDir, source.sourcePagePath);
  try {
    const raw = resolve(brainRoot, source.rawPath);
    const root = resolve(brainRoot);
    if (raw.startsWith(root + '/') || raw === root) await unlink(raw);
  } catch {
    // Missing raw material is surfaced by provenance lint before commit in normal operation.
  }
  pagesDeleted.push(source.sourcePagePath);
  return { sourceId, pagesDeleted, pagesUpdated };
}

async function removeLinksTo(wikiDir: string, targetPath: string): Promise<void> {
  const targetAbs = resolve(wikiDir, targetPath);
  for (const pagePath of await listPages(wikiDir)) {
    const page = await readPage(pagePath);
    let body = page.body;
    let changed = false;
    for (const link of getPageLinksDetailed(page.body)) {
      const linkAbs = resolve(dirname(pagePath), link.target);
      if (linkAbs !== targetAbs) continue;
      const exact = `[${link.text}](${link.target})`;
      body = body
        .split('\n')
        .map((line) => line.trim() === `- ${exact}` ? '' : line.replaceAll(exact, link.text))
        .join('\n');
      changed = true;
    }
    if (changed) await writePage(pagePath, { frontmatter: page.frontmatter, body: body.replace(/\n{3,}/g, '\n\n').trim() });
  }
}

function supportedSummary(body: string, sourceCount: number): string {
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ') || trimmed.startsWith('- [')) continue;
    const value = trimmed.slice(2).trim();
    if (!value || value === 'No durable claims extracted.') continue;
    return value.slice(0, 220);
  }
  return `Knowledge supported by ${sourceCount} remaining source${sourceCount === 1 ? '' : 's'}.`;
}
