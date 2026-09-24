import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import YAML from "yaml";
import { z } from "zod";

const configSchema = z.object({
  brain: z.object({
    remote: z.string().min(1),
    branch: z.string().min(1).default("main"),
    workspace_root: z.string().min(1),
  }),
  git: z.object({
    author_name: z.string().min(1).default("Wikiplane"),
    author_email: z.string().email().default("wikiplane@local"),
    push: z.boolean().default(true),
  }),
  adapters: z.object({
    document: z.enum(["markitdown"]).default("markitdown"),
    web: z.enum(["markitdown"]).default("markitdown"),
  }),
  models: z.object({
    endpoint: z.string().url(),
    roles: z.object({
      integrate: z.string().min(1),
      crosslink: z.string().min(1),
      query: z.string().min(1),
      judge: z.string().min(1).optional(),
    }),
  }),
  ingest: z.object({
    preserve_supplied_source_reference: z.literal(true).default(true),
    retain_original_artifact: z.literal(false).default(false),
    max_download_bytes: z
      .number()
      .int()
      .positive()
      .default(50 * 1024 * 1024),
    timeout_ms: z.number().int().positive().default(30_000),
    redirect_limit: z.number().int().min(0).max(20).default(5),
  }),
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    retain_prompt_bodies: z.literal(false).default(false),
    retain_document_bodies: z.literal(false).default(false),
  }),
});

export type WikiplaneConfig = z.infer<typeof configSchema>;

export function parseConfig(
  input: unknown,
  baseDir = process.cwd(),
): WikiplaneConfig {
  const parsed = configSchema.parse(input);
  return {
    ...parsed,
    brain: {
      ...parsed.brain,
      workspace_root: resolvePath(baseDir, parsed.brain.workspace_root),
      remote: isPathLike(parsed.brain.remote)
        ? resolvePath(baseDir, parsed.brain.remote)
        : parsed.brain.remote,
    },
  };
}

export async function loadConfig(path: string): Promise<WikiplaneConfig> {
  const absolute = resolve(path);
  const raw = await readFile(absolute, "utf8");
  const value = YAML.parse(raw) as unknown;
  return parseConfig(value, dirname(absolute));
}

function isPathLike(value: string): boolean {
  return (
    value.startsWith(".") || value.startsWith("/") || value.startsWith("~")
  );
}

function resolvePath(baseDir: string, value: string): string {
  if (value === "~") return homedir();
  if (value.startsWith("~/")) return resolve(homedir(), value.slice(2));
  return resolve(baseDir, value);
}

export { configSchema };
