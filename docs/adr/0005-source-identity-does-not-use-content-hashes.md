# ADR 0005: Source identity does not use content hashes

**Status:** Accepted
**Date:** 2026-09-24

## Context

PDF conversion and OCR are not byte-stable representations. Converter upgrades, formatting changes, or small transcription improvements can change bytes without changing source identity or useful semantics.

Using a content hash as the identity/change rule would measure representation differences rather than the real source lifecycle.

## Decision

Wikiplane does not use content hashes as source identity or semantic-change semantics.

For v1 remote sources, the exact caller-supplied source reference is the lookup key. The source also receives a stable internal ID. Local refresh uses the stable source record/ID relationship.

Re-ingest quality is judged by semantic convergence and minimal churn.

## Consequences

- The exact same source reference refreshes one source record.
- Different URLs are initially distinct source records even if their documents are equivalent.
- Git history retains prior transcription versions.
- Stability tests must detect duplicate concepts/entities and unnecessary rewriting across transcription drift.
