import { afterEach, describe, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MarkdownConverter,
  SafeSourceAcquirer,
} from "../../packages/adapters/src/index.js";
import {
  PassthroughWebConverter,
  ScriptedModelProvider,
  WorkingTreeRepositoryProvider,
  exerciseDocumentConverterContract,
  exerciseModelProviderContract,
  exerciseRepositoryProviderContract,
  exerciseSourceAcquirerContract,
  exerciseWebConverterContract,
} from "../../packages/testing/src/index.js";

const dirs: string[] = [];
afterEach(async () =>
  Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  ),
);

describe("adapter contracts", () => {
  it("exercises the replaceable v1 boundaries with local/fake implementations", async () => {
    const root = await mkdtemp(join(tmpdir(), "wikiplane-contracts-"));
    dirs.push(root);
    const source = join(root, "source.md");
    await writeFile(source, "# Contract fixture\n");
    const acquiredDir = join(root, "acquired");
    const acquirer = new SafeSourceAcquirer({
      maxBytes: 1024 * 1024,
      timeoutMs: 1000,
      redirectLimit: 1,
    });
    await exerciseSourceAcquirerContract(acquirer, source, acquiredDir);
    const artifact = await acquirer.acquire({
      source,
      operationId: "contract",
      workspaceDir: acquiredDir,
    });

    await exerciseDocumentConverterContract(
      new MarkdownConverter(),
      artifact,
      join(root, "converted"),
    );
    await exerciseWebConverterContract(
      new PassthroughWebConverter(),
      artifact,
      join(root, "web"),
    );
    await exerciseModelProviderContract(
      new ScriptedModelProvider({ query: "contract response" }),
    );
    const brain = join(root, "brain");
    await mkdir(brain);
    await exerciseRepositoryProviderContract(
      new WorkingTreeRepositoryProvider(brain),
      {
        remote: brain,
        branch: "main",
        workspaceRoot: join(root, "workspace"),
        authorName: "Wikiplane",
        authorEmail: "wikiplane@example.invalid",
        push: false,
      },
    );
  });
});
