# Adapter architecture

The application depends on six narrow capability contracts: `SourceAcquirer`, `DocumentConverter`, `WebConverter`, `OcrProvider`, `ModelProvider`, and `RepositoryProvider`.

Concrete v1 implementations are:

- `SafeSourceAcquirer`: controlled HTTP/HTTPS or local-file acquisition.
- `MarkdownConverter`: zero-service Markdown/plain-text path.
- `MarkItDownConverter`: path-based HTTP client to the isolated Python worker; also the baseline HTML converter pending the web-adapter benchmark.
- `GatewayModelProvider`: OpenAI-compatible text/structured calls using logical model aliases.
- `GatewayOcrProvider`: OpenAI-compatible multimodal adapter available for adapter-level use; the MarkItDown OCR plugin normally talks directly to the same gateway endpoint.
- `GitRepositoryProvider`: local or remote Git lifecycle with isolated worktrees and atomic commit semantics.

`packages/testing/src/contracts/` contains reusable contract suites for adapter implementations. Vendor/provider code must not leak into semantic compiler logic.
