# ADR 0003: Copy and adapt Microsoft LLM Wiki core

**Status:** Accepted
**Date:** 2026-09-24

## Context

Microsoft LLM Wiki already provides useful Markdown-wiki primitives and a source/concept/entity philosophy, but Wikiplane needs a standalone capability that is not coupled to the VS Code extension or a runtime `@llmwiki/core` dependency.

## Decision

Vendor the useful LLM Wiki core at a pinned upstream commit, preserve its MIT attribution and relevant regression tests, and adapt it in-place inside `packages/core`.

Do not vendor the VS Code extension as part of Wikiplane.

Upstream provenance is documented under `third_party/` and `docs/upstream-llmwiki-import.md`.

## Consequences

- Wikiplane can change core assumptions such as root-level brain layout.
- Upstream behavior remains traceable through copied tests and provenance.
- Future upstream updates are explicit vendor/import work rather than invisible dependency upgrades.
- License notices must remain correct.
