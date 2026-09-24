# ADR 0001: Markdown and Git are authoritative durable state

**Status:** Accepted
**Date:** 2026-09-24

## Context

Wikiplane needs durable knowledge that is inspectable by humans, portable between tools, browsable on GitHub, auditable through history, and recoverable without a running Wikiplane service.

Databases, embedding stores, and hidden service state would make the knowledge base dependent on runtime infrastructure and complicate recovery.

## Decision

Markdown files stored in Git are the authoritative persistent state of a Wikiplane brain.

Derived indexes, caches, embeddings, databases, or search accelerators may be introduced later only if they can be discarded and rebuilt from the Markdown/Git state.

## Consequences

- A brain remains useful if Wikiplane is unavailable.
- Human GitHub browsing is a supported interface.
- Knowledge changes are reviewable as ordinary diffs.
- Git history supplies auditability and prior raw transcriptions.
- Deterministic rebuild matters because derived navigation must be reproducible.
- Performance optimizations cannot become hidden sources of truth.
