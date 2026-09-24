import { mkdir, readFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { appendEntry, getWikiStatus, readPage } from "@wikiplane/core";
import type { WikiplaneConfig } from "./config.js";
import type {
  DocumentConverter,
  ModelProvider,
  RepositoryProvider,
  SourceAcquirer,
  WebConverter,
} from "./ports.js";
import { operationId } from "./ids.js";
import { initializeBrain, DEFAULT_AGENTS_TEMPLATE } from "./brain.js";
import {
  findSourceByReference,
  findSourceById,
  storeConvertedSource,
} from "./source-store.js";
import { KnowledgeCompiler } from "./compiler.js";
import { rebuildBrain, lintBrain } from "./rebuild.js";
import { queryBrain } from "./query-service.js";
import { removeSourceFromBrain } from "./removal.js";
import { atStage } from "./errors.js";
import { OperationTelemetry } from "./telemetry.js";
import { DEFAULT_PROMPTS, type WikiplanePrompts } from "./prompts.js";

export interface IngestResult {
  status: "success";
  operation_id: string;
  source_id: string;
  title: string;
  created: { concepts: number; entities: number };
  updated_pages: number;
  cross_links_added: number;
  validation: {
    broken_links: number;
    missing_sources: number;
    errors: number;
    warnings: number;
  };
  commit: string | null;
}

export class WikiplaneService {
  private readonly compiler: KnowledgeCompiler;

  constructor(
    private readonly config: WikiplaneConfig,
    private readonly deps: {
      repositories: RepositoryProvider;
      acquirer: SourceAcquirer;
      documentConverters: DocumentConverter[];
      webConverter: WebConverter;
      models: ModelProvider;
      agentsTemplate?: string;
      prompts?: WikiplanePrompts;
    },
  ) {
    this.compiler = new KnowledgeCompiler(
      deps.models,
      deps.prompts ?? DEFAULT_PROMPTS,
    );
  }

  async brainInit(): Promise<{
    status: "success";
    operation_id: string;
    commit: string | null;
  }> {
    return this.transaction(
      "chore(knowledge): initialize wikiplane brain",
      async (root, op) => {
        await initializeBrain(
          root,
          this.deps.agentsTemplate ?? DEFAULT_AGENTS_TEMPLATE,
        );
        const validation = await rebuildBrain(root);
        assertValid(
          validation.errors,
          "Brain initialization validation failed",
        );
        return { status: "success" as const, operation_id: op };
      },
    );
  }

  async ingest(sourceReference: string): Promise<IngestResult> {
    return this.ingestInternal(sourceReference);
  }

  private async ingestInternal(
    sourceReference: string,
    expectedSourceId?: string,
  ): Promise<IngestResult> {
    const op = operationId();
    const telemetry = new OperationTelemetry(
      this.config.brain.workspace_root,
      op,
    );
    await telemetry.event("operation_started", {
      source_reference: sourceReference,
    });
    const session = await atStage("GIT_FAILED", () => this.openRepository());
    const operation = await atStage("GIT_FAILED", () => session.begin(op));
    const artifacts = join(this.config.brain.workspace_root, "artifacts", op);
    await mkdir(artifacts, { recursive: true });
    let acquired: Awaited<ReturnType<SourceAcquirer["acquire"]>> | undefined;
    try {
      await initializeBrain(
        operation.root,
        this.deps.agentsTemplate ?? DEFAULT_AGENTS_TEMPLATE,
      );
      acquired = await telemetry.stage("acquire", () =>
        atStage("ACQUIRE_FAILED", () =>
          this.deps.acquirer.acquire({
            source: sourceReference,
            operationId: op,
            workspaceDir: artifacts,
          }),
        ),
      );
      await telemetry.event("artifact_acquired", {
        media_type: acquired.mediaType,
        bytes: acquired.byteLength,
        resolved_reference: acquired.resolvedReference,
      });
      const converted = await telemetry.stage("convert", () =>
        atStage("CONVERT_FAILED", () => this.convert(acquired!, artifacts)),
      );
      await telemetry.event("source_converted", {
        adapter: converted.adapter,
        adapter_version: converted.adapterVersion,
        diagnostics: sanitizeDiagnostics(converted.diagnostics),
      });
      const markdown = await readFile(converted.markdownPath, "utf8");
      const existing = expectedSourceId
        ? await findSourceById(operation.root, expectedSourceId)
        : await findSourceByReference(
            operation.root,
            acquired.suppliedReference,
          );
      if (expectedSourceId && !existing)
        throw new Error(`Source not found during refresh: ${expectedSourceId}`);
      const source = await storeConvertedSource({
        brainRoot: operation.root,
        suppliedReference:
          existing?.suppliedReference ?? acquired.suppliedReference,
        resolvedReference:
          acquired.resolvedReference ?? existing?.resolvedReference,
        converted,
        markdown,
        existing,
      });
      const compile =
        source.changed || !existing
          ? await telemetry.stage("integrate", () =>
              atStage("INTEGRATION_FAILED", () =>
                this.compiler.integrate({
                  brainRoot: operation.root,
                  source,
                  markdown,
                }),
              ),
            )
          : { created: [], updated: [], crossLinksAdded: 0, modelUsage: [] };
      await telemetry.event("knowledge_integrated", {
        skipped_unchanged_source: !source.changed && Boolean(existing),
        pages_created: compile.created.length,
        pages_updated: compile.updated.length,
        cross_links_added: compile.crossLinksAdded,
        model_calls: compile.modelUsage,
      });
      const validation = await telemetry.stage("rebuild", () =>
        atStage("REBUILD_FAILED", () => rebuildBrain(operation.root)),
      );
      assertValid(validation.errors, "Ingest validation failed");
      const meaningfulChange = Boolean(
        source.changed ||
        compile.created.length ||
        compile.updated.length ||
        compile.crossLinksAdded ||
        validation.changed,
      );
      if (meaningfulChange) {
        await appendEntry(join(operation.root, "wiki", "log.md"), {
          verb: existing ? "refreshed" : "ingested",
          subject: source.title,
          details: `${existing ? "Refreshed" : "Ingested"} ${source.suppliedReference} as ${source.id}; ${compile.created.length} pages created, ${compile.updated.length} updated, ${compile.crossLinksAdded} links added.`,
        });
      }
      const commit = await telemetry.stage("commit", () =>
        atStage("GIT_FAILED", () =>
          operation.commit(`feat(knowledge): ingest ${source.title}`),
        ),
      );
      if (commit && this.config.git.push)
        await telemetry.stage("push", () =>
          atStage("PUSH_FAILED", () => operation.push()),
        );
      await telemetry.event("operation_completed", {
        source_id: source.id,
        commit,
        validation_errors: validation.errors,
        validation_warnings: validation.warnings,
      });
      const createdTypes = await countPageTypes(
        operation.root,
        compile.created,
      );
      return {
        status: "success",
        operation_id: op,
        source_id: source.id,
        title: source.title,
        created: createdTypes,
        updated_pages: compile.updated.length,
        cross_links_added: compile.crossLinksAdded,
        validation: validationSummary(validation),
        commit,
      };
    } catch (error) {
      await telemetry.event("operation_failed", {
        failure_stage:
          error && typeof error === "object" && "stage" in error
            ? String((error as { stage: unknown }).stage)
            : "UNKNOWN",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await acquired?.cleanup?.().catch(() => undefined);
      await rm(artifacts, { recursive: true, force: true }).catch(
        () => undefined,
      );
      await operation.close().catch(() => undefined);
      await session.close().catch(() => undefined);
    }
  }

  async refresh(sourceId: string): Promise<IngestResult> {
    const source = await this.readSource(sourceId);
    const acquisitionReference = /^https?:\/\//i.test(source.suppliedReference)
      ? source.suppliedReference
      : (source.resolvedReference ?? source.suppliedReference);
    return this.ingestInternal(acquisitionReference, sourceId);
  }

  async removeSource(sourceId: string): Promise<unknown> {
    return this.transaction(
      `feat(knowledge): remove ${sourceId}`,
      async (root, op) => {
        const result = await removeSourceFromBrain(root, sourceId);
        const validation = await rebuildBrain(root);
        assertValid(validation.errors, "Source removal validation failed");
        await appendEntry(join(root, "wiki", "log.md"), {
          verb: "removed source",
          subject: sourceId,
          details: `Removed ${sourceId}; deleted ${result.pagesDeleted.length} pages and updated ${result.pagesUpdated.length}.`,
        });
        return {
          status: "success",
          operation_id: op,
          ...result,
          validation: validationSummary(validation),
        };
      },
    );
  }

  async rebuild(check = false): Promise<unknown> {
    if (check) {
      return this.readOnly(async (root) => ({
        status: "success",
        ...(await rebuildBrain(root, true)),
      }));
    }
    return this.transaction(
      "chore(knowledge): rebuild derived state",
      async (root, op) => {
        const result = await rebuildBrain(root, false);
        assertValid(result.errors, "Rebuild validation failed");
        if (result.changed) {
          await appendEntry(join(root, "wiki", "log.md"), {
            verb: "rebuilt",
            subject: "wiki",
            details: `Regenerated deterministic navigation for ${result.pageCount} indexed pages.`,
          });
        }
        return { status: "success", operation_id: op, ...result };
      },
    );
  }

  async lint(): Promise<unknown> {
    return this.readOnly(async (root) => ({
      status: "success",
      ...(await lintBrain(root)),
    }));
  }

  async status(): Promise<unknown> {
    return this.readOnly((root) => getWikiStatus(root));
  }

  async query(question: string): Promise<unknown> {
    return this.readOnly((root) =>
      queryBrain(
        root,
        question,
        this.deps.models,
        this.deps.prompts?.query ?? DEFAULT_PROMPTS.query,
      ),
    );
  }

  async recompile(): Promise<unknown> {
    return this.transaction(
      "feat(knowledge): recompile wiki",
      async (root, op) => {
        const conceptDir = join(root, "wiki", "concepts");
        const entityDir = join(root, "wiki", "entities");
        await rm(conceptDir, { recursive: true, force: true });
        await rm(entityDir, { recursive: true, force: true });
        await mkdir(conceptDir, { recursive: true });
        await mkdir(entityDir, { recursive: true });
        const rawFiles = (await readdir(join(root, "raw")))
          .filter((name) => name.endsWith(".md"))
          .sort();
        let sourcesCompiled = 0;
        for (const name of rawFiles) {
          const raw = await readPage(join(root, "raw", name));
          const id = String(raw.frontmatter.id ?? "");
          if (!id) continue;
          const source = await findSourceById(root, id);
          if (!source)
            throw new Error(
              `Raw transcription ${name} has no source page ${id}`,
            );
          await this.compiler.integrate({
            brainRoot: root,
            source,
            markdown: raw.body,
          });
          await rebuildBrain(root);
          sourcesCompiled += 1;
        }
        const validation = await rebuildBrain(root);
        assertValid(validation.errors, "Recompile validation failed");
        await appendEntry(join(root, "wiki", "log.md"), {
          verb: "recompiled",
          subject: "wiki",
          details: `Recompiled ${sourcesCompiled} sources from raw Markdown.`,
        });
        return {
          status: "success",
          operation_id: op,
          sources_compiled: sourcesCompiled,
          validation: validationSummary(validation),
        };
      },
    );
  }

  private async convert(
    artifact: Awaited<ReturnType<SourceAcquirer["acquire"]>>,
    outputDir: string,
  ) {
    if (
      artifact.mediaType?.includes("html") ||
      /\.html?$/i.test(artifact.filename)
    ) {
      return this.deps.webConverter.convert(artifact, outputDir);
    }
    const converter = this.deps.documentConverters.find((candidate) =>
      candidate.supports(artifact),
    );
    if (!converter)
      throw new Error(
        `No DocumentConverter supports ${artifact.filename} (${artifact.mediaType ?? "unknown"})`,
      );
    return converter.convert(artifact, outputDir);
  }

  private async transaction<T extends object>(
    message: string,
    fn: (root: string, op: string) => Promise<T>,
  ): Promise<T & { commit: string | null }> {
    const op = operationId();
    const session = await this.openRepository();
    const operation = await session.begin(op);
    try {
      const result = await fn(operation.root, op);
      const commit = await operation.commit(message);
      if (commit && this.config.git.push) await operation.push();
      return { ...result, commit };
    } finally {
      await operation.close().catch(() => undefined);
      await session.close().catch(() => undefined);
    }
  }

  private async readOnly<T>(fn: (root: string) => Promise<T>): Promise<T> {
    const session = await this.openRepository();
    const op = operationId();
    const operation = await session.begin(op);
    try {
      return await fn(operation.root);
    } finally {
      await operation.close().catch(() => undefined);
      await session.close().catch(() => undefined);
    }
  }

  private openRepository() {
    return this.deps.repositories.open({
      remote: this.config.brain.remote,
      branch: this.config.brain.branch,
      workspaceRoot: this.config.brain.workspace_root,
      authorName: this.config.git.author_name,
      authorEmail: this.config.git.author_email,
      push: this.config.git.push,
    });
  }

  private async readSource(sourceId: string) {
    return this.readOnly(async (root) => {
      const source = await findSourceById(root, sourceId);
      if (!source) throw new Error(`Source not found: ${sourceId}`);
      return source;
    });
  }
}

function assertValid(errors: number, message: string): void {
  if (errors > 0) throw new Error(`${message}: ${errors} error(s)`);
}
function validationSummary(result: {
  errors: number;
  warnings: number;
  findings: Array<{ category: string }>;
}) {
  return {
    broken_links: result.findings.filter(
      (finding) => finding.category === "broken-links",
    ).length,
    missing_sources: result.findings.filter(
      (finding) =>
        finding.category === "provenance" ||
        finding.category === "missing-sources",
    ).length,
    errors: result.errors,
    warnings: result.warnings,
  };
}
async function countPageTypes(
  root: string,
  paths: string[],
): Promise<{ concepts: number; entities: number }> {
  let concepts = 0;
  let entities = 0;
  for (const path of paths) {
    const page = await readPage(join(root, "wiki", path));
    if (page.frontmatter.type === "concept") concepts += 1;
    if (page.frontmatter.type === "entity") entities += 1;
  }
  return { concepts, entities };
}

function sanitizeDiagnostics(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const blocked = /(body|content|document|markdown|prompt|transcript|text)/i;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (blocked.test(key)) continue;
    if (typeof item === "string") output[key] = item.slice(0, 500);
    else if (
      typeof item === "number" ||
      typeof item === "boolean" ||
      item === null
    )
      output[key] = item;
    else if (Array.isArray(item))
      output[key] = item
        .slice(0, 50)
        .map((entry) =>
          typeof entry === "string"
            ? entry.slice(0, 200)
            : typeof entry === "number" ||
                typeof entry === "boolean" ||
                entry === null
              ? entry
              : "[omitted]",
        );
  }
  return output;
}
