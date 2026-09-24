# ADR 0012: Query the compiled wiki first

**Status:** Accepted
**Date:** 2026-09-24

## Context

The purpose of ingestion is to precompile durable, interlinked knowledge. Re-reading the entire raw corpus for every question would waste model context and undermine the value of the compiled wiki.

## Decision

Normal query retrieval operates on `wiki/` gold content. V1 uses bounded lexical/index/frontmatter-style retrieval rather than requiring a vector database.

Raw-source fallback is not part of the normal query path and must be explicit if added later.

## Consequences

- Query cost scales with selected relevant wiki context rather than the full raw corpus.
- Query quality depends on ingestion/compiler quality.
- Embeddings may be introduced only as disposable derived state.
- Answers should expose relevant stored wiki/source references where practical.
