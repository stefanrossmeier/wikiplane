import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import {
  loadConfig,
  loadPrompts,
  WikiplaneService,
  type ModelRole,
} from "@wikiplane/application";
import {
  GatewayModelProvider,
  GitRepositoryProvider,
  MarkdownConverter,
  MarkItDownConverter,
  SafeSourceAcquirer,
} from "@wikiplane/adapters";

const repositoryConfigRoot = resolve(
  fileURLToPath(new URL("../../../config/", import.meta.url)),
);

export async function createService(
  configPath: string,
): Promise<WikiplaneService> {
  const config = await loadConfig(configPath);
  const gateway = new GatewayModelProvider({
    endpoint: config.models.endpoint,
    roles: {
      integrate: config.models.roles.integrate,
      crosslink: config.models.roles.crosslink,
      query: config.models.roles.query,
      judge: config.models.roles.judge,
    } satisfies Record<ModelRole, string | undefined>,
  });
  const markitdown = new MarkItDownConverter({
    endpoint: process.env.MARKITDOWN_ENDPOINT ?? "http://127.0.0.1:8010",
    timeoutMs: Number(process.env.MARKITDOWN_TIMEOUT_MS ?? "180000"),
  });
  const configRoot = process.env.WIKIPLANE_ASSET_ROOT
    ? resolve(process.env.WIKIPLANE_ASSET_ROOT)
    : repositoryConfigRoot;
  const prompts = await loadPrompts(join(configRoot, "prompts"));
  let agentsTemplate: string | undefined;
  try {
    agentsTemplate = await readFile(
      join(configRoot, "schema", "AGENTS.template.md"),
      "utf8",
    );
  } catch {
    // Application fallback keeps installed packages self-contained.
  }
  return new WikiplaneService(config, {
    repositories: new GitRepositoryProvider(),
    acquirer: new SafeSourceAcquirer({
      maxBytes: config.ingest.max_download_bytes,
      timeoutMs: config.ingest.timeout_ms,
      redirectLimit: config.ingest.redirect_limit,
    }),
    documentConverters: [new MarkdownConverter(), markitdown],
    webConverter: markitdown,
    models: gateway,
    agentsTemplate,
    prompts,
  });
}
