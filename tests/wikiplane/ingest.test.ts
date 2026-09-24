import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { readPage } from "../../packages/core/src/wiki.js";
import {
  WikiplaneService,
  type WikiplaneConfig,
} from "../../packages/application/src/index.js";
import { MarkdownConverter } from "../../packages/adapters/src/converters.js";
import {
  FileSourceAcquirer,
  ScriptedModelProvider,
  WorkingTreeRepositoryProvider,
} from "../../packages/testing/src/index.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

function config(root: string): WikiplaneConfig {
  return {
    brain: {
      remote: root,
      branch: "main",
      workspace_root: join(root, ".workspace"),
    },
    git: {
      author_name: "Wikiplane",
      author_email: "wikiplane@example.invalid",
      push: false,
    },
    adapters: {
      document: "markitdown",
      web: "markitdown",
    },
    models: {
      endpoint: "http://unused.invalid/v1",
      roles: {
        integrate: "integrate",
        crosslink: "crosslink",
        query: "query",
      },
    },
    ingest: {
      preserve_supplied_source_reference: true,
      retain_original_artifact: false,
      max_download_bytes: 1024 * 1024,
      timeout_ms: 1000,
      redirect_limit: 2,
    },
    logging: {
      level: "info",
      retain_prompt_bodies: false,
      retain_document_bodies: false,
    },
  };
}

function models() {
  return new ScriptedModelProvider({
    integrate: JSON.stringify({
      knowledge: [
        {
          page_type: "concept",
          title: "Git-native knowledge",
          summary: "Knowledge stored as ordinary Git-tracked Markdown.",
          tags: ["git", "markdown"],
          claims: [
            "Durable knowledge is stored in Markdown and versioned by Git.",
          ],
        },
        {
          page_type: "entity",
          title: "Wikiplane",
          summary: "A Git-native wiki compiler.",
          tags: ["wikiplane"],
          claims: [
            "Wikiplane compiles sources into a cross-referenced Markdown wiki.",
          ],
        },
      ],
      contradictions: [],
    }),
    crosslink: JSON.stringify({
      links: [
        {
          from: "concepts/git-native-knowledge.md",
          to: "entities/wikiplane.md",
          reason: "Wikiplane implements the concept.",
        },
      ],
    }),
    query:
      "Wikiplane stores compiled knowledge in Git-tracked Markdown. [concepts/git-native-knowledge.md]",
  });
}

describe("end-to-end Markdown ingest", () => {
  it("preserves exact source identity, creates knowledge, crosslinks, and converges on re-ingest", async () => {
    const root = await mkdtemp(join(tmpdir(), "wikiplane-e2e-"));
    dirs.push(root);
    const input = join(root, "paper.md");
    await writeFile(
      input,
      "# Paper\n\nWikiplane stores durable knowledge as Markdown in Git.\n",
      "utf8",
    );
    const repository = new WorkingTreeRepositoryProvider(root);
    const model = models();
    const service = new WikiplaneService(config(root), {
      repositories: repository,
      acquirer: new FileSourceAcquirer(),
      documentConverters: [new MarkdownConverter()],
      webConverter: {
        name: "unused",
        async convert() {
          throw new Error("unused");
        },
      },
      models: model,
    });

    const first = await service.ingest(input);
    expect(first.source_id).toMatch(/^src_/);
    expect(first.created).toEqual({ concepts: 1, entities: 1 });
    expect(first.cross_links_added).toBe(1);
    expect(first.validation.errors).toBe(0);

    const source = await readPage(
      join(root, "wiki", "sources", `${first.source_id}.md`),
    );
    expect(source.frontmatter.source_url).toBe(input);
    const conceptPath = join(
      root,
      "wiki",
      "concepts",
      "git-native-knowledge.md",
    );
    const conceptBefore = await readFile(conceptPath, "utf8");
    expect(conceptBefore).toContain(
      `wikiplane:claims:${first.source_id}:start`,
    );
    expect(conceptBefore).toContain("../entities/wikiplane.md");

    const modelCallsAfterFirst = model.calls.length;
    const second = await service.ingest(input);
    expect(second.source_id).toBe(first.source_id);
    expect(second.created).toEqual({ concepts: 0, entities: 0 });
    expect(second.updated_pages).toBe(0);
    expect(model.calls.length).toBe(modelCallsAfterFirst);
    const conceptAfter = await readFile(conceptPath, "utf8");
    expect(conceptAfter).toBe(conceptBefore);

    const query = (await service.query("How is durable knowledge stored?")) as {
      answer: string;
      references: Array<{ path: string }>;
    };
    expect(query.answer).toContain("Git-tracked Markdown");
    expect(
      query.references.some(
        (ref) => ref.path === "concepts/git-native-knowledge.md",
      ),
    ).toBe(true);
  });

  it("refreshes a local source by source ID while preserving its originally supplied reference", async () => {
    const root = await mkdtemp(join(tmpdir(), "wikiplane-refresh-"));
    dirs.push(root);
    const input = join(root, "relative-source.md");
    await writeFile(input, "# Source\n\nInitial fact.\n", "utf8");
    const supplied = relative(process.cwd(), input);
    const model = models();
    const service = new WikiplaneService(config(root), {
      repositories: new WorkingTreeRepositoryProvider(root),
      acquirer: new FileSourceAcquirer(),
      documentConverters: [new MarkdownConverter()],
      webConverter: {
        name: "unused",
        async convert() {
          throw new Error("unused");
        },
      },
      models: model,
    });

    const first = await service.ingest(supplied);
    await writeFile(input, "# Source\n\nChanged fact.\n", "utf8");
    const refreshed = await service.refresh(first.source_id);
    expect(refreshed.source_id).toBe(first.source_id);
    const source = await readPage(
      join(root, "wiki", "sources", `${first.source_id}.md`),
    );
    expect(source.frontmatter.source_url).toBe(supplied);
    expect(source.frontmatter.resolved_url).toBe(input);
  });

  it("preserves material contradictions and reevaluates them on source removal", async () => {
    const root = await mkdtemp(join(tmpdir(), "wikiplane-contradiction-"));
    dirs.push(root);
    const inputA = join(root, "source-a.md");
    const inputB = join(root, "source-b.md");
    await writeFile(
      inputA,
      "# Source A\n\nThe retention period is 90 days.",
      "utf8",
    );
    await writeFile(
      inputB,
      "# Source B\n\nThe retention period is 30 days.",
      "utf8",
    );
    let priorId = "";
    let integrationCall = 0;
    const model = new ScriptedModelProvider({
      integrate: () => {
        integrationCall += 1;
        if (integrationCall === 1) {
          return JSON.stringify({
            knowledge: [
              {
                page_type: "concept",
                title: "Retention period",
                summary: "Documented retention periods.",
                tags: [],
                claims: ["The retention period is 90 days."],
              },
            ],
            contradictions: [],
          });
        }
        return JSON.stringify({
          knowledge: [
            {
              page_type: "concept",
              title: "Retention period",
              summary: "Documented retention periods.",
              tags: [],
              claims: ["The retention period is 30 days."],
            },
          ],
          contradictions: [
            {
              page_type: "concept",
              title: "Retention period",
              statement:
                "This source says 30 days while the earlier source says 90 days.",
              conflicting_source_ids: [priorId],
            },
          ],
        });
      },
      crosslink: JSON.stringify({ links: [] }),
      query: "unused",
    });
    const service = new WikiplaneService(config(root), {
      repositories: new WorkingTreeRepositoryProvider(root),
      acquirer: new FileSourceAcquirer(),
      documentConverters: [new MarkdownConverter()],
      webConverter: {
        name: "unused",
        async convert() {
          throw new Error("unused");
        },
      },
      models: model,
    });

    const first = await service.ingest(inputA);
    priorId = first.source_id;
    const second = await service.ingest(inputB);
    const pagePath = join(root, "wiki", "concepts", "retention-period.md");
    let page = await readFile(pagePath, "utf8");
    expect(page).toContain("## Contradictions");
    expect(page).toContain("30 days while the earlier source says 90 days");
    expect(page).toContain(first.source_id);
    expect(page).toContain(second.source_id);

    await service.removeSource(second.source_id);
    page = await readFile(pagePath, "utf8");
    expect(page).toContain("90 days");
    expect(page).not.toContain("30 days while the earlier source says 90 days");
    expect(page).not.toContain(second.source_id);

    await service.removeSource(first.source_id);
    await expect(readFile(pagePath, "utf8")).rejects.toThrow();
  });
});
