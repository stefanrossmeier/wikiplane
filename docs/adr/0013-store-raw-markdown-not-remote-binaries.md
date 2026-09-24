# ADR 0013: Store raw Markdown transcriptions, not original remote binaries

**Status:** Accepted
**Date:** 2026-09-24

## Context

Wikiplane needs durable source material for inspection, provenance, recompile, and history, but retaining every remote binary would increase storage, licensing, privacy, and repository-size concerns.

## Decision

For remote sources, original artifacts are temporary. Wikiplane persists the canonical converted Markdown transcription in `raw/` together with provenance metadata and discards the remote binary after successful processing.

## Consequences

- Brains remain text/Git friendly.
- Recompile can operate without reacquiring every remote source.
- Exact source references must be retained because the original artifact is not archived.
- Binary archival is explicitly outside the v1 product scope.
