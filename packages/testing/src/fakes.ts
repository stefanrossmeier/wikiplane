import { copyFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type {
  AcquiredArtifact,
  AcquireRequest,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelRole,
  RepositoryOperation,
  RepositoryProvider,
  RepositorySession,
  RepositoryTarget,
  SourceAcquirer,
} from "@wikiplane/application";

export class ScriptedModelProvider implements ModelProvider {
  readonly calls: ModelRequest[] = [];
  constructor(
    private readonly responses: Partial<
      Record<ModelRole, string | ((request: ModelRequest) => string)>
    >,
  ) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    this.calls.push(request);
    const response = this.responses[request.role];
    const content =
      typeof response === "function" ? response(request) : response;
    if (content === undefined)
      throw new Error(`No scripted response for role ${request.role}`);
    return {
      content,
      model: `fake-${request.role}`,
      provider: "test",
      usage: { total_tokens: 0 },
    };
  }
}

export class WorkingTreeRepositoryProvider implements RepositoryProvider {
  commits: string[] = [];
  constructor(readonly root: string) {}

  async open(_target: RepositoryTarget): Promise<RepositorySession> {
    const { root, commits } = this;
    return {
      async begin(operationId: string): Promise<RepositoryOperation> {
        return {
          operationId,
          root,
          async commit(message: string) {
            commits.push(message);
            return `test-commit-${commits.length}`;
          },
          async push() {},
          async close() {},
        };
      },
      async close() {},
    };
  }
}

export class FileSourceAcquirer implements SourceAcquirer {
  async acquire(request: AcquireRequest): Promise<AcquiredArtifact> {
    await mkdir(request.workspaceDir, { recursive: true });
    const sourcePath = resolve(request.source);
    const destination = join(request.workspaceDir, basename(sourcePath));
    await copyFile(sourcePath, destination);
    return {
      kind: "local",
      suppliedReference: request.source,
      resolvedReference: sourcePath,
      localPath: destination,
      filename: basename(sourcePath),
      mediaType: "text/markdown",
    };
  }
}

export class PassthroughWebConverter {
  readonly name = "fake-web";
  async convert(artifact: AcquiredArtifact, outputDir: string) {
    await mkdir(outputDir, { recursive: true });
    const destination = join(outputDir, "web.md");
    await copyFile(artifact.localPath, destination);
    return {
      markdownPath: destination,
      adapter: this.name,
      adapterVersion: "1",
    };
  }
}
