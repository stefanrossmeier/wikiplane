import { join } from "node:path";
import { readIndex, readPage } from "@wikiplane/core";
import type { ModelProvider } from "./ports.js";
import { DEFAULT_PROMPTS } from "./prompts.js";
import { isSourceId } from "./ids.js";
import { atStage } from "./errors.js";

export interface BrainQueryResult {
  answer: string;
  references: Array<{ title: string; path: string; sourceUrls: string[] }>;
  model?: string;
  usage?: Record<string, unknown>;
}

export async function queryBrain(
  brainRoot: string,
  question: string,
  models: ModelProvider,
  systemPrompt = DEFAULT_PROMPTS.query,
): Promise<BrainQueryResult> {
  const terms = tokenize(question);
  const entries = await readIndex(join(brainRoot, "wiki", "index.md"));
  const scored: Array<{
    score: number;
    title: string;
    path: string;
    body: string;
    sourceUrls: string[];
  }> = [];
  for (const entry of entries.filter((value) => value.category !== "Sources")) {
    const page = await readPage(join(brainRoot, "wiki", entry.path));
    const haystack =
      `${entry.title}\n${entry.summary}\n${entry.tags.join(" ")}\n${page.body}`.toLowerCase();
    const score =
      terms.reduce((sum, term) => sum + count(haystack, term), 0) +
      terms.reduce(
        (sum, term) => sum + count(entry.title.toLowerCase(), term) * 4,
        0,
      );
    if (score <= 0) continue;
    const sourceUrls = await sourceUrlsForPage(
      brainRoot,
      page.frontmatter.sources,
    );
    scored.push({
      score,
      title: entry.title,
      path: entry.path,
      body: page.body,
      sourceUrls,
    });
  }
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const selected = scored.slice(0, 8);
  const context = selected
    .map(
      (item) =>
        `PAGE: ${item.path}\nTITLE: ${item.title}\nSOURCES: ${item.sourceUrls.join(", ")}\n${item.body.slice(0, 6000)}`,
    )
    .join("\n\n---\n\n");

  if (selected.length === 0)
    return {
      answer: "No relevant compiled wiki pages were found.",
      references: [],
    };
  const response = await atStage("MODEL_FAILED", () =>
    models.complete({
      role: "query",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `QUESTION:\n${question}\n\nCOMPILED WIKI CONTEXT:\n${context}`,
        },
      ],
    }),
  );
  return {
    answer: response.content,
    references: selected.map(({ title, path, sourceUrls }) => ({
      title,
      path,
      sourceUrls,
    })),
    model: response.model,
    usage: response.usage,
  };
}

async function sourceUrlsForPage(
  brainRoot: string,
  value: unknown,
): Promise<string[]> {
  if (!Array.isArray(value)) return [];
  const urls: string[] = [];
  for (const id of value.filter(
    (item): item is string => typeof item === "string",
  )) {
    if (!isSourceId(id)) continue;
    try {
      const source = await readPage(
        join(brainRoot, "wiki", "sources", `${id}.md`),
      );
      if (typeof source.frontmatter.source_url === "string")
        urls.push(source.frontmatter.source_url);
    } catch {
      // A lint error will expose missing provenance; query stays bounded to readable pages.
    }
  }
  return [...new Set(urls)];
}
function tokenize(value: string): string[] {
  return [
    ...new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []),
  ];
}
function count(text: string, term: string): number {
  let hits = 0;
  let offset = 0;
  while ((offset = text.indexOf(term, offset)) >= 0) {
    hits += 1;
    offset += term.length;
  }
  return hits;
}
