# Wikiplane implementation plan — current status

The original implementation plan was used to bootstrap Wikiplane. Durable architecture decisions have since been distilled into [Architecture Decision Records](adr/README.md), and intentionally deferred work is tracked in [BACKLOG.md](BACKLOG.md). This document now records only the implemented milestone state so it does not compete with the ADRs as an architecture source of truth.

## Implemented baseline

- [x] TypeScript/pnpm workspace and Docker-first runtime.
- [x] Adapted Microsoft LLM Wiki core with retained MIT provenance.
- [x] Storage-only brain format: `raw/`, `wiki/`, `AGENTS.md`, deterministic index and log.
- [x] Adapter boundaries for acquisition, document/web conversion, models, and repositories.
- [x] Controlled HTTP/HTTPS and local-file acquisition.
- [x] Markdown and MarkItDown document conversion paths.
- [x] Safeplane-derived OpenAI-compatible model gateway with recorded upstream provenance.
- [x] Structured semantic mutations for source/concept/entity integration.
- [x] Contradiction preservation and high-precision cross-link proposals.
- [x] Deterministic rebuild/lint and stale-derived-state checks.
- [x] Git worktree transactions with rollback and atomic commit semantics.
- [x] Stable source identity without content hashes.
- [x] Re-ingest convergence for unchanged sources.
- [x] Gold-wiki-first query path.
- [x] Source removal and safe recompile lifecycle.
- [x] CLI and high-level MCP surfaces.
- [x] Local bootstrap scripts, unit/integration tests, quality checks, Docker build checks, and CI workflows.
- [x] Public project documentation, security reporting policy, security model, and ADR set.

## Verified test baseline

The current deterministic baseline is 388 Node/Vitest tests and 6 Python service tests. Publication still requires the repository quality and Docker gates to be green in the maintainer environment.

## Remaining work

Evidence-driven or deferred work is tracked in [BACKLOG.md](BACKLOG.md). The most important remaining release work is web-adapter selection, model evaluation, broader semantic/golden evaluation, and full Docker end-to-end validation.
