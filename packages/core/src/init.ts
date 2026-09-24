import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { appendEntry } from "./log.js";
import { API_VERSION } from "./constants.js";
import { isNotFoundError } from "./errors.js";

/**
 * Result of running the init command.
 */
export interface InitResult {
  command: string;
  api_version: string;
  status: "created" | "already_initialized";
  created_dirs: string[];
  created_files: string[];
  warning?: string;
}

/** Directories created by init, relative to root. */
const DIRS = [
  "raw",
  "wiki",
  "wiki/entities",
  "wiki/concepts",
  "wiki/sources",
] as const;

/** The starter wiki/index.md with empty category sections. */
const INDEX_CONTENT = `# Wiki Index

## Entities

## Concepts

## Sources
`;

/** AGENTS.md starter schema template for Wikiplane brain repositories. */
const AGENTS_CONTENT = `# AGENTS.md

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
 * Initialize a wiki knowledge base at the given path.
 * Creates the wiki structure directly in the supplied brain repository root.
 * Wikiplane intentionally does not create a hidden `.wiki/` directory.
 *
 * Returns a structured result describing what was created.
 */
export async function initWiki(targetPath: string): Promise<InitResult> {
  const root = resolve(targetPath);
  const wikiDir = join(root, "wiki");

  // Detect if already initialized
  try {
    const wikiStat = await stat(wikiDir);
    if (wikiStat.isDirectory()) {
      return {
        command: "init",
        api_version: API_VERSION,
        status: "already_initialized",
        created_dirs: [],
        created_files: [],
        warning: "Wiki is already initialized (wiki/ directory exists)",
      };
    }
  } catch (err) {
    if (!isNotFoundError(err)) throw err;
    // Directory does not exist — proceed with init
  }

  // Create directory structure
  for (const dir of DIRS) {
    await mkdir(join(root, dir), { recursive: true });
  }

  // Create wiki/index.md with category sections
  const indexPath = join(root, "wiki", "index.md");
  await writeFile(indexPath, INDEX_CONTENT, "utf-8");

  // Create wiki/log.md with initialization entry
  const logPath = join(root, "wiki", "log.md");
  await appendEntry(logPath, {
    verb: "initialized",
    subject: "wiki",
    details: "Wiki knowledge base initialized.",
  });

  // Create AGENTS.md with starter schema
  const agentsPath = join(root, "AGENTS.md");
  await writeFile(agentsPath, AGENTS_CONTENT, "utf-8");

  const createdFiles = ["wiki/index.md", "wiki/log.md", "AGENTS.md"];

  return {
    command: "init",
    api_version: API_VERSION,
    status: "created",
    created_dirs: [...DIRS],
    created_files: createdFiles,
  };
}
