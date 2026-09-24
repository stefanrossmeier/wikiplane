import { join, relative } from "node:path";
import { access } from "node:fs/promises";
import { z } from "zod";
import {
  addCrosslinks,
  listPages,
  readIndex,
  readPage,
  slugify,
  writePage,
  type WikiPage,
} from "@wikiplane/core";
import type { ModelProvider } from "./ports.js";
import type { StoredSource } from "./source-store.js";
import { isSourceId } from "./ids.js";
import { DEFAULT_PROMPTS, type WikiplanePrompts } from "./prompts.js";
import { atStage } from "./errors.js";

const knowledgeMutationSchema = z.object({
  page_type: z.enum(["concept", "entity"]),
  title: z.string().min(1).max(240),
  summary: z.string().max(1000).default(""),
  tags: z.array(z.string().max(64)).max(20).default([]),
  claims: z.array(z.string().min(1).max(2000)).max(50).default([]),
});

const contradictionSchema = z.object({
  page_type: z.enum(["concept", "entity"]),
  title: z.string().min(1).max(240),
  statement: z.string().min(1).max(2000),
  conflicting_source_ids: z
    .array(z.string().refine(isSourceId, "invalid source id"))
    .max(20)
    .default([]),
});

const integrationResponseSchema = z.object({
  knowledge: z.array(knowledgeMutationSchema).max(100).default([]),
  contradictions: z.array(contradictionSchema).max(50).default([]),
});

const crosslinkResponseSchema = z.object({
  links: z
    .array(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        reason: z.string().default(""),
      }),
    )
    .max(100)
    .default([]),
});

export interface CompileResult {
  created: string[];
  updated: string[];
  crossLinksAdded: number;
  modelUsage: Record<string, unknown>[];
}

export class KnowledgeCompiler {
  constructor(
    private readonly models: ModelProvider,
    private readonly prompts: WikiplanePrompts = DEFAULT_PROMPTS,
  ) {}

  async integrate(input: {
    brainRoot: string;
    source: StoredSource;
    markdown: string;
  }): Promise<CompileResult> {
    const candidateContext = await buildCandidateContext(
      input.brainRoot,
      input.markdown,
    );
    const response = await atStage("MODEL_FAILED", () =>
      this.models.complete({
        role: "integrate",
        responseFormat: "json_object",
        messages: [
          {
            role: "system",
            content: integrationSystemPrompt(input.source.id, this.prompts),
          },
          {
            role: "user",
            content: [
              `SOURCE ID: ${input.source.id}`,
              `SOURCE TITLE: ${input.source.title}`,
              `SOURCE REFERENCE: ${input.source.suppliedReference}`,
              "",
              "RELEVANT EXISTING WIKI PAGES:",
              candidateContext || "(none)",
              "",
              "SOURCE TRANSCRIPTION:",
              clamp(input.markdown, 120_000),
            ].join("\n"),
          },
        ],
      }),
    );

    const parsed = integrationResponseSchema.parse(
      parseJsonObject(response.content),
    );
    const created: string[] = [];
    const updated: string[] = [];
    const changed: string[] = [];

    for (const rawMutation of parsed.knowledge) {
      const mutation = normalizeKnowledgeMutation(rawMutation);
      const result = await upsertKnowledgePage(
        input.brainRoot,
        input.source,
        mutation,
      );
      if (result.created) created.push(result.path);
      else if (result.changed) updated.push(result.path);
      if (result.created || result.changed) changed.push(result.path);
    }

    for (const rawContradiction of parsed.contradictions) {
      const contradiction = normalizeContradiction(rawContradiction);
      const result = await upsertContradiction(
        input.brainRoot,
        input.source,
        contradiction,
      );
      if (result.changed && !changed.includes(result.path))
        changed.push(result.path);
      if (
        result.changed &&
        !created.includes(result.path) &&
        !updated.includes(result.path)
      )
        updated.push(result.path);
    }

    const crosslinkResult = await atStage("CROSSLINK_FAILED", () =>
      this.crosslink({
        brainRoot: input.brainRoot,
        changedPages: changed,
      }),
    );

    return {
      created: unique(created),
      updated: unique(updated),
      crossLinksAdded: crosslinkResult.added,
      modelUsage: [
        {
          role: "integrate",
          model: response.model,
          provider: response.provider,
          usage: response.usage ?? {},
        },
        ...(crosslinkResult.model
          ? [
              {
                role: "crosslink",
                model: crosslinkResult.model,
                provider: crosslinkResult.provider,
                usage: crosslinkResult.usage ?? {},
              },
            ]
          : []),
      ],
    };
  }

  private async crosslink(input: {
    brainRoot: string;
    changedPages: string[];
  }): Promise<{
    added: number;
    usage?: Record<string, unknown>;
    model?: string;
    provider?: string;
  }> {
    if (input.changedPages.length === 0) return { added: 0 };
    const wikiDir = join(input.brainRoot, "wiki");
    const pageRecords: Array<{ path: string; title: string; summary: string }> =
      [];
    for (const fullPath of await listPages(wikiDir)) {
      const rel = relative(wikiDir, fullPath).replace(/\\/g, "/");
      if (!rel.startsWith("concepts/") && !rel.startsWith("entities/"))
        continue;
      const page = await readPage(fullPath);
      pageRecords.push({
        path: rel,
        title: String(page.frontmatter.title ?? rel),
        summary: String(page.frontmatter.summary ?? ""),
      });
    }
    pageRecords.sort((a, b) => a.path.localeCompare(b.path));
    const candidates = pageRecords
      .slice(0, 200)
      .map((entry) => `${entry.path} | ${entry.title} | ${entry.summary}`)
      .join("\n");

    if (!candidates.trim()) return { added: 0 };

    const response = await this.models.complete({
      role: "crosslink",
      responseFormat: "json_object",
      messages: [
        {
          role: "system",
          content: `${this.prompts.crosslink}

Return ONLY JSON {"links":[{"from":"concepts/a.md","to":"entities/b.md","reason":"..."}]}. The from path must be one of the changed pages.`,
        },
        {
          role: "user",
          content: `CHANGED PAGES:\n${input.changedPages.join("\n")}\n\nAVAILABLE PAGES:\n${candidates}`,
        },
      ],
    });

    const parsed = crosslinkResponseSchema.parse(
      parseJsonObject(response.content),
    );
    let added = 0;
    const existingPaths = new Set(pageRecords.map((entry) => entry.path));
    for (const link of parsed.links.slice(0, 50)) {
      if (!input.changedPages.includes(link.from)) continue;
      if (
        link.from === link.to ||
        !existingPaths.has(link.from) ||
        !existingPaths.has(link.to)
      )
        continue;
      const before = await readPage(join(input.brainRoot, "wiki", link.from));
      await addCrosslinks(join(input.brainRoot, "wiki"), link.from, [link.to]);
      const after = await readPage(join(input.brainRoot, "wiki", link.from));
      if (before.body !== after.body) added += 1;
    }
    return {
      added,
      usage: response.usage,
      model: response.model,
      provider: response.provider,
    };
  }
}

async function upsertKnowledgePage(
  brainRoot: string,
  source: StoredSource,
  mutation: z.infer<typeof knowledgeMutationSchema>,
): Promise<{ path: string; created: boolean; changed: boolean }> {
  const dir = mutation.page_type === "concept" ? "concepts" : "entities";
  const path = `${dir}/${slugify(mutation.title) || "untitled"}.md`;
  const full = join(brainRoot, "wiki", path);
  const existing = await readOptionalPage(full);
  const now = new Date().toISOString();
  const sourceIds = unique([
    ...(asStringArray(existing?.frontmatter.sources) ?? []),
    source.id,
  ]);
  const tags = unique([
    ...(asStringArray(existing?.frontmatter.tags) ?? []),
    ...mutation.tags,
  ]);
  const sourceLink = relative(
    join(brainRoot, "wiki", dir),
    join(brainRoot, "wiki", source.sourcePagePath),
  ).replace(/\\/g, "/");
  const block = claimBlock(source, sourceLink, mutation.claims);
  const body = replaceSourceBlock(
    existing?.body ??
      `# ${mutation.title}\n\n${mutation.summary ? `${mutation.summary}\n\n` : ""}## Claims`,
    `claims:${source.id}`,
    block,
  );

  const baseFrontmatter = {
    ...(existing?.frontmatter ?? {}),
    id:
      existing?.frontmatter.id ??
      `${mutation.page_type}_${slugify(mutation.title)}`,
    type: mutation.page_type,
    title: existing?.frontmatter.title ?? mutation.title,
    summary: mutation.summary || existing?.frontmatter.summary || "",
    tags,
    sources: sourceIds,
    created: existing?.frontmatter.created ?? now,
    updated: existing?.frontmatter.updated ?? now,
  };
  const semanticallyChanged =
    !existing ||
    existing.body !== body ||
    JSON.stringify({ ...existing.frontmatter, updated: undefined }) !==
      JSON.stringify({ ...baseFrontmatter, updated: undefined });
  if (semanticallyChanged) {
    await writePage(full, {
      frontmatter: { ...baseFrontmatter, updated: now },
      body,
    });
  }
  return { path, created: !existing, changed: semanticallyChanged };
}

async function upsertContradiction(
  brainRoot: string,
  source: StoredSource,
  contradiction: z.infer<typeof contradictionSchema>,
): Promise<{ path: string; changed: boolean }> {
  const dir = contradiction.page_type === "concept" ? "concepts" : "entities";
  const path = `${dir}/${slugify(contradiction.title) || "untitled"}.md`;
  const full = join(brainRoot, "wiki", path);
  const existing = await readOptionalPage(full);
  if (!existing) {
    await upsertKnowledgePage(brainRoot, source, {
      page_type: contradiction.page_type,
      title: contradiction.title,
      summary: "",
      tags: [],
      claims: [],
    });
  }
  const page = (await readOptionalPage(full))!;
  const related = unique([source.id, ...contradiction.conflicting_source_ids]);
  const block = [
    `### Disagreement involving ${related.map((id) => `\`${id}\``).join(", ")}`,
    "",
    `- ${contradiction.statement}`,
  ].join("\n");
  const nextBody = replaceSourceBlock(
    page.body,
    `contradictions:${source.id}`,
    block,
    "## Contradictions",
  );
  const nextSources = unique([
    ...(asStringArray(page.frontmatter.sources) ?? []),
    ...related,
  ]);
  const changed =
    nextBody !== page.body ||
    JSON.stringify(nextSources) !==
      JSON.stringify(asStringArray(page.frontmatter.sources) ?? []);
  if (changed) {
    page.body = nextBody;
    page.frontmatter.sources = nextSources;
    page.frontmatter.updated = new Date().toISOString();
    await writePage(full, page);
  }
  return { path, changed };
}

function claimBlock(
  source: StoredSource,
  sourceLink: string,
  claims: string[],
): string {
  const lines = [`### From [${source.title}](${sourceLink})`, ""];
  if (claims.length === 0) lines.push("- No durable claims extracted.");
  else for (const claim of claims) lines.push(`- ${claim}`);
  return lines.join("\n");
}

function replaceSourceBlock(
  body: string,
  key: string,
  block: string,
  sectionHeader = "## Claims",
): string {
  const start = `<!-- wikiplane:${key}:start -->`;
  const end = `<!-- wikiplane:${key}:end -->`;
  const rendered = `${start}\n${block.trim()}\n${end}`;
  const escapedStart = escapeRegExp(start);
  const escapedEnd = escapeRegExp(end);
  const pattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, "m");
  if (pattern.test(body)) return body.replace(pattern, rendered).trim();
  const normalized = body.trim();
  if (normalized.includes(sectionHeader)) return `${normalized}\n\n${rendered}`;
  return `${normalized}\n\n${sectionHeader}\n\n${rendered}`;
}

export function removeSourceBlocks(body: string, sourceId: string): string {
  const keyedPattern = new RegExp(
    `\n?<!-- wikiplane:(?:claims|contradictions):${escapeRegExp(sourceId)}:start -->[\\s\\S]*?<!-- wikiplane:(?:claims|contradictions):${escapeRegExp(sourceId)}:end -->\n?`,
    "g",
  );
  let next = body.replace(keyedPattern, "\n");
  // A contradiction block generated while processing another source can still name the
  // removed source. Such a disagreement no longer has two live provenance legs and must
  // be reconsidered. Removing it is deterministic; a later refresh/recompile may create
  // a still-supported contradiction again.
  const contradictionPattern =
    /\n?<!-- wikiplane:contradictions:([^:]+):start -->[\s\S]*?<!-- wikiplane:contradictions:\1:end -->\n?/g;
  next = next.replace(contradictionPattern, (block) =>
    block.includes(`\`${sourceId}\``) ? "\n" : block,
  );
  return next.replace(/\n{3,}/g, "\n\n").trim();
}

async function buildCandidateContext(
  brainRoot: string,
  markdown: string,
): Promise<string> {
  const entries = await readIndex(join(brainRoot, "wiki", "index.md"));
  const terms = significantTerms(markdown);
  const scored = entries
    .filter(
      (entry) => entry.category === "Concepts" || entry.category === "Entities",
    )
    .map((entry) => ({
      entry,
      score: terms.reduce(
        (score, term) =>
          score +
          occurrences(
            `${entry.title} ${entry.summary} ${entry.tags.join(" ")}`,
            term,
          ),
        0,
      ),
    }))
    .filter((value) => value.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const parts: string[] = [];
  let budget = 20_000;
  for (const { entry } of scored) {
    if (budget <= 0) break;
    const page = await readOptionalPage(join(brainRoot, "wiki", entry.path));
    if (!page) continue;
    const rendered = `PATH: ${entry.path}\nTITLE: ${entry.title}\n${clamp(page.body, 2500)}`;
    parts.push(clamp(rendered, budget));
    budget -= rendered.length;
  }
  return parts.join("\n\n---\n\n");
}

function normalizeKnowledgeMutation(
  mutation: z.infer<typeof knowledgeMutationSchema>,
): z.infer<typeof knowledgeMutationSchema> {
  const title = plainMetadata(mutation.title, 240);
  if (!title)
    throw new Error("Model knowledge title became empty after sanitization");
  return {
    ...mutation,
    title,
    summary: plainMetadata(mutation.summary, 1000),
    tags: unique(
      mutation.tags.map((tag) => slugify(tag)).filter(Boolean),
    ).slice(0, 20),
    claims: mutation.claims
      .map((claim) => safeMarkdownSentence(claim, 2000))
      .filter(Boolean),
  };
}

function normalizeContradiction(
  contradiction: z.infer<typeof contradictionSchema>,
): z.infer<typeof contradictionSchema> {
  const title = plainMetadata(contradiction.title, 240);
  const statement = safeMarkdownSentence(contradiction.statement, 2000);
  if (!title)
    throw new Error(
      "Model contradiction title became empty after sanitization",
    );
  if (!statement)
    throw new Error(
      "Model contradiction statement became empty after sanitization",
    );
  return {
    ...contradiction,
    title,
    statement,
    conflicting_source_ids: unique(contradiction.conflicting_source_ids),
  };
}

function stripControlCharacters(value: string): string {
  let result = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    result += code <= 0x1f || code === 0x7f ? " " : character;
  }
  return result;
}

function plainMetadata(value: string, max: number): string {
  return stripControlCharacters(value)
    .replaceAll("[", "")
    .replaceAll("]", "")
    .replaceAll("<", "")
    .replaceAll(">", "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeMarkdownSentence(value: string, max: number): string {
  return stripControlCharacters(value)
    .replace(/\\/g, "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function integrationSystemPrompt(
  sourceId: string,
  prompts: WikiplanePrompts,
): string {
  return `${prompts.integrate}\n\n${prompts.contradiction}\n\nThe current source ID is ${sourceId}. Return ONLY a JSON object with keys knowledge and contradictions. knowledge items must be {page_type:"concept"|"entity",title,summary,tags,claims}. contradictions items must be {page_type,title,statement,conflicting_source_ids}. Do not emit Markdown, file paths, or prose outside JSON.`;
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1]);
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start)
      return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Model response did not contain a JSON object");
  }
}

async function readOptionalPage(path: string): Promise<WikiPage | null> {
  try {
    await access(path);
    return await readPage(path);
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}
function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
function clamp(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}\n…[truncated]`;
}
function significantTerms(text: string): string[] {
  const counts = new Map<string, number>();
  for (const token of text.toLowerCase().match(/[a-z0-9][a-z0-9-]{3,}/g) ??
    []) {
    if (STOP_WORDS.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([term]) => term);
}
function occurrences(text: string, term: string): number {
  const haystack = text.toLowerCase();
  let count = 0;
  let offset = 0;
  while ((offset = haystack.indexOf(term, offset)) >= 0) {
    count += 1;
    offset += term.length;
  }
  return count;
}
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const STOP_WORDS = new Set([
  "that",
  "with",
  "from",
  "this",
  "have",
  "will",
  "into",
  "their",
  "about",
  "there",
  "which",
  "when",
  "were",
  "been",
  "also",
  "than",
  "then",
  "they",
  "them",
  "your",
  "using",
]);
