# Adapter architecture

The application depends on five narrow capability contracts: `SourceAcquirer`, `DocumentConverter`, `WebConverter`, `ModelProvider`, and `RepositoryProvider`.

Concrete v1 implementations are:

- `SafeSourceAcquirer`: controlled HTTP/HTTPS or local-file acquisition.
- `MarkdownConverter`: zero-service Markdown/plain-text path.
- `MarkItDownConverter`: path-based HTTP client to the isolated Python worker; also the baseline HTML converter pending the web-adapter benchmark.
- `GatewayModelProvider`: OpenAI-compatible text/structured calls using logical model aliases.
- `GitRepositoryProvider`: local or remote Git lifecycle with isolated worktrees and atomic commit semantics.

`packages/testing/src/contracts/` contains reusable contract suites for adapter implementations. Vendor/provider code must not leak into semantic compiler logic.
