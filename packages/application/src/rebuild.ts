import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import {
  getBacklinks,
  lintWiki,
  listPages,
  readPage,
  writeIndex,
  type IndexEntry,
  type LintFinding,
} from '@wikiplane/core';
import { isSourceId } from './ids.js';

export interface RebuildResult {
  changed: boolean;
  pageCount: number;
  backlinkCount: number;
  errors: number;
  warnings: number;
  findings: LintFinding[];
}

export async function rebuildBrain(brainRoot: string, check = false): Promise<RebuildResult> {
  const wikiDir = join(brainRoot, 'wiki');
  const indexPath = join(wikiDir, 'index.md');
  const entries = await deriveIndexEntries(wikiDir);
  const before = await readText(indexPath);
  const tmp = await mkdtemp(join(tmpdir(), 'wikiplane-index-'));
  const renderedPath = join(tmp, 'index.md');
  await writeIndex(renderedPath, entries);
  const rendered = await readFile(renderedPath, 'utf8');
  await rm(tmp, { recursive: true, force: true });
  const changed = before !== rendered;
  if (!check && changed) await writeIndex(indexPath, entries);

  const schemaFindings = await validateSchema(brainRoot, wikiDir);
  try {
    await access(join(brainRoot, 'AGENTS.md'));
  } catch {
    schemaFindings.push({ severity: 'error', category: 'schema', message: 'Brain repository is missing AGENTS.md.', file: 'AGENTS.md' });
  }
  const lint = await lintWiki(brainRoot);
  const findings = [...schemaFindings, ...lint.findings];
  let backlinkCount = 0;
  for (const entry of entries) backlinkCount += (await getBacklinks(wikiDir, entry.path)).length;

  if (check && changed) {
    findings.unshift({
      severity: 'error',
      category: 'stale-derived-state',
      message: 'wiki/index.md is stale; run `wikiplane rebuild`.',
      file: 'wiki/index.md',
    });
  }

  return {
    changed,
    pageCount: entries.length,
    backlinkCount,
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    findings,
  };
}

export async function lintBrain(brainRoot: string): Promise<RebuildResult> {
  return rebuildBrain(brainRoot, true);
}

async function deriveIndexEntries(wikiDir: string): Promise<IndexEntry[]> {
  const pages = (await listPages(wikiDir)).filter((path) => {
    const rel = relative(wikiDir, path).replace(/\\/g, '/');
    return rel !== 'index.md' && rel !== 'log.md' && !rel.startsWith('queries/');
  });
  const entries: IndexEntry[] = [];
  for (const path of pages) {
    const page = await readPage(path);
    const type = String(page.frontmatter.type ?? '');
    if (!['source', 'concept', 'entity'].includes(type)) continue;
    const rel = relative(wikiDir, path).replace(/\\/g, '/');
    const title = String(page.frontmatter.title ?? basename(path, '.md'));
    const summary =
      type === 'source' && typeof page.frontmatter.source_url === 'string'
        ? `Source: ${page.frontmatter.source_url}`
        : typeof page.frontmatter.summary === 'string' && page.frontmatter.summary.trim()
          ? page.frontmatter.summary.trim()
          : firstParagraph(page.body);
    entries.push({
      path: rel,
      title,
      summary: summary.slice(0, 220),
      category: type === 'source' ? 'Sources' : type === 'concept' ? 'Concepts' : 'Entities',
      tags: Array.isArray(page.frontmatter.tags)
        ? page.frontmatter.tags.filter((value): value is string => typeof value === 'string')
        : [],
    });
  }
  const categoryOrder = new Map([
    ['Concepts', 0],
    ['Entities', 1],
    ['Sources', 2],
  ]);
  return entries.sort(
    (a, b) =>
      (categoryOrder.get(a.category) ?? 99) - (categoryOrder.get(b.category) ?? 99) ||
      a.title.localeCompare(b.title) ||
      a.path.localeCompare(b.path),
  );
}

async function validateSchema(brainRoot: string, wikiDir: string): Promise<LintFinding[]> {
  const findings: LintFinding[] = [];
  const ids = new Map<string, string>();
  const sourceIds = new Set<string>();
  const pages = await listPages(wikiDir);
  for (const path of pages) {
    const rel = relative(wikiDir, path).replace(/\\/g, '/');
    if (rel === 'index.md' || rel === 'log.md' || rel.startsWith('queries/')) continue;
    const page = await readPage(path);
    if (page.frontmatter.type === 'source' && typeof page.frontmatter.id === 'string' && isSourceId(page.frontmatter.id)) {
      sourceIds.add(page.frontmatter.id);
    }
  }
  for (const path of pages) {
    const rel = relative(wikiDir, path).replace(/\\/g, '/');
    if (rel === 'index.md' || rel === 'log.md' || rel.startsWith('queries/')) continue;
    const page = await readPage(path);
    const type = page.frontmatter.type;
    if (!['source', 'concept', 'entity'].includes(String(type ?? ''))) {
      findings.push({ severity: 'error', category: 'frontmatter', message: 'Missing or invalid page type.', file: `wiki/${rel}` });
    }
    for (const key of ['id', 'title'] as const) {
      if (typeof page.frontmatter[key] !== 'string' || !String(page.frontmatter[key]).trim()) {
        findings.push({ severity: 'error', category: 'frontmatter', message: `Missing required frontmatter field: ${key}`, file: `wiki/${rel}` });
      }
    }
    if (typeof page.frontmatter.id === 'string') {
      const duplicate = ids.get(page.frontmatter.id);
      if (duplicate) {
        findings.push({ severity: 'error', category: 'duplicate-id', message: `Duplicate id ${page.frontmatter.id} also used by ${duplicate}`, file: `wiki/${rel}` });
      } else ids.set(page.frontmatter.id, `wiki/${rel}`);
    }
    if (type === 'source') {
      if (typeof page.frontmatter.id !== 'string' || !isSourceId(page.frontmatter.id)) {
        findings.push({ severity: 'error', category: 'source-id', message: 'Source page has an invalid source id.', file: `wiki/${rel}` });
      } else if (rel !== `sources/${page.frontmatter.id}.md`) {
        findings.push({ severity: 'error', category: 'source-id', message: `Source page filename must match id ${page.frontmatter.id}.`, file: `wiki/${rel}` });
      }
    }
    if (type === 'concept' || type === 'entity') {
      if (!Array.isArray(page.frontmatter.sources)) {
        findings.push({ severity: 'error', category: 'missing-sources', message: 'Knowledge page frontmatter sources must be an array.', file: `wiki/${rel}` });
      } else {
        for (const sourceId of page.frontmatter.sources.filter((value): value is string => typeof value === 'string')) {
          if (!isSourceId(sourceId) || !sourceIds.has(sourceId)) {
            findings.push({ severity: 'error', category: 'missing-sources', message: `Knowledge page references missing or invalid source id: ${sourceId}`, file: `wiki/${rel}` });
          }
        }
      }
    }
    if (type === 'source') {
      if (typeof page.frontmatter.source_url !== 'string' || !page.frontmatter.source_url) {
        findings.push({ severity: 'error', category: 'provenance', message: 'Source page is missing exact source_url provenance.', file: `wiki/${rel}` });
      }
      if (typeof page.frontmatter.source_path !== 'string' || !page.frontmatter.source_path.startsWith('raw/')) {
        findings.push({ severity: 'error', category: 'provenance', message: 'Source page is missing raw source_path.', file: `wiki/${rel}` });
      } else {
        const rawRoot = resolve(brainRoot, 'raw');
        const rawCandidate = resolve(brainRoot, page.frontmatter.source_path);
        const withinRaw = relative(rawRoot, rawCandidate);
        if (!withinRaw || withinRaw.startsWith('..') || resolve(rawRoot, withinRaw) !== rawCandidate) {
          findings.push({ severity: 'error', category: 'provenance', message: `Source transcription path escapes raw/: ${page.frontmatter.source_path}`, file: `wiki/${rel}` });
        } else {
          try {
            await access(rawCandidate);
          } catch {
            findings.push({ severity: 'error', category: 'provenance', message: `Source transcription is missing: ${page.frontmatter.source_path}`, file: `wiki/${rel}` });
          }
        }
      }
    }
  }
  return findings;
}

function firstParagraph(body: string): string {
  return (
    body
      .split(/\n\s*\n/)
      .map((part) => part.replace(/^#+\s+.*$/gm, '').replace(/<!--.*?-->/g, '').trim())
      .find((part) => part && !part.startsWith('- **')) ?? ''
  ).replace(/\s+/g, ' ');
}
async function readText(path: string): Promise<string> {
  try { return await readFile(path, 'utf8'); } catch { return ''; }
}
