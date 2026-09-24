import { basename, extname, join, relative, resolve } from "node:path";
import { access, mkdir, readdir } from "node:fs/promises";
import { readPage, writePage, slugify } from "@wikiplane/core";
import { assertSourceId, sourceId as createSourceId } from "./ids.js";
import type { ConvertedSource } from "./ports.js";

export interface StoredSource {
  id: string;
  title: string;
  suppliedReference: string;
  resolvedReference?: string;
  rawPath: string;
  sourcePagePath: string;
  retrievedAt: string;
  adapter: string;
  adapterVersion?: string;
  changed?: boolean;
}

export async function findSourceByReference(
  brainRoot: string,
  suppliedReference: string,
): Promise<StoredSource | null> {
  const dir = join(brainRoot, "wiki", "sources");
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return null;
  }
  for (const name of names.filter((value) => value.endsWith(".md"))) {
    const page = await readPage(join(dir, name));
    if (page.frontmatter.source_url !== suppliedReference) continue;
    const id = String(page.frontmatter.id ?? name.replace(/\.md$/, ""));
    assertSourceId(id);
    if (name !== `${id}.md`)
      throw new Error(
        `Source page filename/id mismatch: ${name} contains ${id}`,
      );
    const rawPath = safeRawPath(
      brainRoot,
      String(page.frontmatter.source_path ?? ""),
    );
    return {
      id,
      title: String(page.frontmatter.title ?? id),
      suppliedReference,
      resolvedReference:
        typeof page.frontmatter.resolved_url === "string"
          ? page.frontmatter.resolved_url
          : undefined,
      rawPath,
      sourcePagePath: `sources/${name}`,
      retrievedAt: String(page.frontmatter.retrieved_at ?? ""),
      adapter: String(page.frontmatter.adapter ?? "unknown"),
      adapterVersion:
        typeof page.frontmatter.adapter_version === "string"
          ? page.frontmatter.adapter_version
          : undefined,
    };
  }
  return null;
}

export async function storeConvertedSource(input: {
  brainRoot: string;
  suppliedReference: string;
  resolvedReference?: string;
  converted: ConvertedSource;
  markdown: string;
  existing?: StoredSource | null;
}): Promise<StoredSource> {
  const id = input.existing?.id ?? createSourceId();
  assertSourceId(id);
  const title = safeTitle(
    input.converted.title?.trim() ||
      input.existing?.title ||
      titleFromPath(input.converted.markdownPath),
  );
  const rawName = `${id}-${slugify(title) || "source"}.md`;
  const rawRel = safeRawPath(
    input.brainRoot,
    input.existing?.rawPath || `raw/${rawName}`,
  );
  const rawFull = join(input.brainRoot, rawRel);
  const sourceRel = `sources/${id}.md`;
  const sourceFull = join(input.brainRoot, "wiki", sourceRel);

  await mkdir(join(input.brainRoot, "raw"), { recursive: true });
  await mkdir(join(input.brainRoot, "wiki", "sources"), { recursive: true });

  const existingRaw = await readOptionalPage(rawFull);
  const normalizedMarkdown = input.markdown.trim();
  const metadataChanged =
    !existingRaw ||
    String(existingRaw.frontmatter.source_url ?? "") !==
      input.suppliedReference ||
    nullableString(existingRaw.frontmatter.resolved_url) !==
      (input.resolvedReference ?? undefined) ||
    String(existingRaw.frontmatter.adapter ?? "") !== input.converted.adapter ||
    nullableString(existingRaw.frontmatter.adapter_version) !==
      input.converted.adapterVersion ||
    String(existingRaw.frontmatter.title ?? "") !== title;
  const transcriptionChanged =
    !existingRaw || existingRaw.body !== normalizedMarkdown;
  const changed = !input.existing || metadataChanged || transcriptionChanged;
  // Do not create a commit merely because the same source was checked again.
  // Retrieval diagnostics live in runtime telemetry; the durable timestamp changes only
  // when the stored transcription/provenance itself changes.
  const retrievedAt = changed
    ? new Date().toISOString()
    : input.existing?.retrievedAt ||
      String(existingRaw?.frontmatter.retrieved_at ?? new Date().toISOString());

  if (changed) {
    await writePage(rawFull, {
      frontmatter: {
        id,
        type: "source-transcription",
        title,
        source_url: input.suppliedReference,
        resolved_url: input.resolvedReference ?? null,
        retrieved_at: retrievedAt,
        adapter: input.converted.adapter,
        adapter_version: input.converted.adapterVersion ?? null,
      },
      body: normalizedMarkdown,
    });

    const rawLink = relative(
      join(input.brainRoot, "wiki", "sources"),
      rawFull,
    ).replace(/\\/g, "/");
    await writePage(sourceFull, {
      frontmatter: {
        id,
        type: "source",
        title,
        source_url: input.suppliedReference,
        resolved_url: input.resolvedReference ?? null,
        source_path: rawRel,
        retrieved_at: retrievedAt,
        adapter: input.converted.adapter,
        adapter_version: input.converted.adapterVersion ?? null,
      },
      body: [
        `# ${title}`,
        "",
        `- **Source:** ${formatExternalReference(input.suppliedReference)}`,
        input.resolvedReference &&
        input.resolvedReference !== input.suppliedReference
          ? `- **Resolved URL:** ${formatExternalReference(input.resolvedReference)}`
          : "",
        `- **Raw transcription:** [${basename(rawRel)}](${rawLink})`,
        `- **Retrieved:** ${retrievedAt}`,
        `- **Converter:** ${input.converted.adapter}${input.converted.adapterVersion ? ` ${input.converted.adapterVersion}` : ""}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } else {
    // A source page should always exist if the source record exists. Surface repository
    // corruption immediately rather than silently minting a second representation.
    await access(sourceFull);
  }

  return {
    id,
    title,
    suppliedReference: input.suppliedReference,
    resolvedReference: input.resolvedReference,
    rawPath: rawRel,
    sourcePagePath: sourceRel,
    retrievedAt,
    adapter: input.converted.adapter,
    adapterVersion: input.converted.adapterVersion,
    changed,
  };
}

async function readOptionalPage(path: string) {
  try {
    await access(path);
    return await readPage(path);
  } catch {
    return null;
  }
}

function nullableString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function titleFromPath(path: string): string {
  const name = basename(path, extname(path)).replace(/[-_]+/g, " ").trim();
  return name || "Untitled source";
}

function formatExternalReference(reference: string): string {
  if (!/^https?:\/\//i.test(reference)) return escapeMarkdownText(reference);
  const label = escapeMarkdownText(reference);
  const target = reference.replaceAll("<", "%3C").replaceAll(">", "%3E");
  return `[${label}](<${target}>)`;
}

function safeTitle(value: string): string {
  const normalized = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return normalized.slice(0, 240) || "Untitled source";
}

function escapeMarkdownText(value: string): string {
  return value
    .replace(/([\\[\]`])/g, "\\$1")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function safeRawPath(brainRoot: string, value: string): string {
  const normalized = value.replace(/\\/g, "/");
  if (!normalized.startsWith("raw/") || normalized.includes("\0")) {
    throw new Error(`Invalid raw source path: ${value}`);
  }
  const rawRoot = resolve(brainRoot, "raw");
  const candidate = resolve(brainRoot, normalized);
  const withinRaw = relative(rawRoot, candidate);
  if (
    !withinRaw ||
    withinRaw.startsWith("..") ||
    resolve(rawRoot, withinRaw) !== candidate
  ) {
    throw new Error(`Raw source path escapes raw/: ${value}`);
  }
  return normalized;
}

export async function findSourceById(
  brainRoot: string,
  id: string,
): Promise<StoredSource | null> {
  assertSourceId(id);
  const path = join(brainRoot, "wiki", "sources", `${id}.md`);
  try {
    await access(path);
  } catch {
    return null;
  }
  const page = await readPage(path);
  if (String(page.frontmatter.type ?? "") !== "source") {
    throw new Error(`Source page ${id}.md has invalid type`);
  }
  const storedId = String(page.frontmatter.id ?? "");
  assertSourceId(storedId);
  if (storedId !== id)
    throw new Error(`Source page ${id}.md contains mismatched id ${storedId}`);
  const suppliedReference = String(page.frontmatter.source_url ?? "");
  if (!suppliedReference)
    throw new Error(`Source page ${id}.md is missing source_url`);
  return {
    id,
    title: String(page.frontmatter.title ?? id),
    suppliedReference,
    resolvedReference:
      typeof page.frontmatter.resolved_url === "string"
        ? page.frontmatter.resolved_url
        : undefined,
    rawPath: safeRawPath(brainRoot, String(page.frontmatter.source_path ?? "")),
    sourcePagePath: `sources/${id}.md`,
    retrievedAt: String(page.frontmatter.retrieved_at ?? ""),
    adapter: String(page.frontmatter.adapter ?? "unknown"),
    adapterVersion:
      typeof page.frontmatter.adapter_version === "string"
        ? page.frontmatter.adapter_version
        : undefined,
  };
}
