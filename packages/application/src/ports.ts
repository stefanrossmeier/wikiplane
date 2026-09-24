export type SourceKind = "remote" | "local";

export interface AcquireRequest {
  source: string;
  operationId: string;
  workspaceDir: string;
}

export interface AcquiredArtifact {
  kind: SourceKind;
  suppliedReference: string;
  resolvedReference?: string;
  localPath: string;
  filename: string;
  mediaType?: string;
  byteLength?: number;
  cleanup?: () => Promise<void>;
}

export interface ConvertedSource {
  markdownPath: string;
  title?: string;
  adapter: string;
  adapterVersion?: string;
  diagnostics?: Record<string, unknown>;
}

export interface SourceAcquirer {
  acquire(request: AcquireRequest): Promise<AcquiredArtifact>;
}

export interface DocumentConverter {
  readonly name: string;
  supports(artifact: AcquiredArtifact): boolean;
  convert(
    artifact: AcquiredArtifact,
    outputDir: string,
  ): Promise<ConvertedSource>;
}

export interface WebConverter {
  readonly name: string;
  convert(
    artifact: AcquiredArtifact,
    outputDir: string,
  ): Promise<ConvertedSource>;
}

export type ModelRole = "integrate" | "crosslink" | "query" | "judge";

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelRequest {
  role: ModelRole;
  messages: ModelMessage[];
  responseFormat?: "text" | "json_object";
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ModelResponse {
  content: string;
  model?: string;
  provider?: string;
  usage?: Record<string, unknown>;
  finishReason?: string;
}

export interface ModelProvider {
  complete(request: ModelRequest): Promise<ModelResponse>;
}

export interface RepositoryTarget {
  remote: string;
  branch: string;
  workspaceRoot: string;
  authorName: string;
  authorEmail: string;
  push: boolean;
}

export interface RepositoryOperation {
  operationId: string;
  root: string;
  commit(message: string): Promise<string | null>;
  push(): Promise<void>;
  close(): Promise<void>;
}

export interface RepositorySession {
  begin(operationId: string): Promise<RepositoryOperation>;
  close(): Promise<void>;
}

export interface RepositoryProvider {
  open(target: RepositoryTarget): Promise<RepositorySession>;
}
