# Microsoft LLM Wiki upstream import

Repository: https://github.com/microsoft/llmwiki
Commit: b44df6ae95138d0edcbcc79b5b1d099c78bce5e0
Commit date: 2026-08-12T16:40:12-07:00
License: MIT

Copied paths:

- packages/core/ -> packages/core/
- tests/shared/ -> tests/shared/
- tests/fixtures/ -> tests/fixtures/
- LICENSE -> third_party/llmwiki/LICENSE

Reference-only upstream files are retained under:

- third_party/llmwiki/reference/

The VS Code extension in packages/vscode/ was intentionally not copied.

## Wikiplane adaptations

The copied core is kept recognizable but adapted so the supplied brain repository is the root (no hidden `.wiki/` directory), raw transcription links may resolve outside `wiki/` while staying inside the brain, status counts Wikiplane Markdown sources, and low-level imported MCP code is not exported as the product MCP surface.
