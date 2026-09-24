# @wikiplane/core

This package is the adapted Microsoft LLM Wiki core vendored into Wikiplane. Import provenance and the retained MIT license are under `third_party/llmwiki/`.

Wikiplane keeps the upstream Markdown/Git primitives but treats the supplied **brain repository root** as the wiki root: `raw/`, `wiki/`, and `AGENTS.md` are direct children. The VS Code extension is not included. Low-level upstream MCP source remains internal for regression/provenance purposes; Wikiplane's supported high-level MCP server lives in `packages/mcp`.

Application workflows should normally use `@wikiplane/application`, not orchestrate low-level core mutations directly.
