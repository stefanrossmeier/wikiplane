# ADR 0007: Preserve contradictions

**Status:** Accepted
**Date:** 2026-09-24

## Context

Legitimate sources can disagree. A second-brain system that silently replaces one claim with another loses information and obscures provenance.

## Decision

Contradictory source-backed claims are preserved. Concept/entity pages may represent multiple incompatible claims, their supporting sources, and an explicit disagreement when material.

Removal or refresh of a contradictory source re-evaluates the affected knowledge rather than treating contradiction as an ingestion error.

## Consequences

- Query answers can accurately state that sources disagree.
- Source-scoped claim support is necessary for removal semantics.
- Semantic evaluation must include contradiction cases.
- Wikiplane does not automatically decide which legitimate source is "correct" merely because it was ingested later.
