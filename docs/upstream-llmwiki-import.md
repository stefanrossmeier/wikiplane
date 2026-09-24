# Microsoft LLM Wiki import

Wikiplane vendors the useful Microsoft LLM Wiki core instead of taking a runtime dependency. The exact imported commit is recorded in `third_party/llmwiki/UPSTREAM.md`, with the upstream MIT license retained alongside it.

The VS Code extension is excluded. Core regression tests/fixtures are retained in their upstream-compatible `tests/shared` and `tests/fixtures` locations. Wikiplane adapts the core to treat the supplied brain directory itself as the root (`raw/`, `wiki/`, `AGENTS.md`) rather than creating a hidden `.wiki/` directory. Low-level imported MCP code is retained internally for provenance/regression purposes but is not exported as Wikiplane's product MCP surface; `packages/mcp` exposes high-level operations.
