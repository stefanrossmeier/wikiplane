# Wikiplane product and architecture requirements

This document summarizes the current product contract. Detailed rationale lives in [ARCHITECTURE.md](../ARCHITECTURE.md) and [docs/adr/](adr/README.md). Deferred ideas live in [BACKLOG.md](BACKLOG.md).

## Product definition

Wikiplane is a Git-native Markdown wiki capability that turns external source material into a structured, cross-referenced, queryable knowledge base. It acquires sources, converts them to Markdown, integrates durable knowledge, preserves provenance and contradictions, rebuilds deterministic navigation, validates the result, and commits successful state through Git transactions.

## Repository boundaries

The system repository owns implementation, adapters, models, conversion, query, Git transactions, configuration, tests, and runtime services. A separate brain repository stores only durable Markdown state: `AGENTS.md`, `raw/`, and `wiki/`. Safeplane is a downstream consumer and should call high-level Wikiplane operations rather than reproduce ingestion internals.

## Durable state

Markdown and Git are authoritative. Databases, caches, embeddings, or indexes may be added only as rebuildable derived state. Original downloaded binaries are temporary; converted Markdown plus provenance is durable.

## Source semantics

For remote sources, the exact caller-supplied reference is the v1 identity key. Content hashes do not determine source identity or semantic change. Re-ingesting the same source should converge with minimal unrelated churn. Different URLs are initially distinct source records.

## Knowledge model

The initial ontology is intentionally small: source, concept, and entity. Contradictory legitimate claims are preserved with source-scoped provenance instead of silently resolved. Models propose structured mutations; deterministic code validates and applies them.

## Adapter boundary

Replaceable external capabilities are accessed through Wikiplane-owned interfaces: `SourceAcquirer`, `DocumentConverter`, `WebConverter`, `ModelProvider`, and `RepositoryProvider`. Provider-specific implementation details must not leak into semantic compiler logic.

## Models

Model access uses logical roles (`integrate`, `crosslink`, `query`, optional `judge`) through an OpenAI-compatible gateway. Concrete provider/model assignments are configuration and evaluation outcomes, not architecture decisions.

## Git and lifecycle

Knowledge-changing operations run in isolated worktrees, rebuild and lint before commit, and produce atomic validated commits. Failed operations do not become gold state. `rebuild` is deterministic and model-free; `recompile` is semantic and model-backed.

## Query

Ordinary queries read the compiled `wiki/` state rather than rereading the full raw corpus. Retrieval starts with deterministic/lexical metadata and links; any future embedding index remains disposable.

## Security

Remote content and model output are untrusted. Acquisition blocks unsafe destinations and bounds redirects, time, and bytes. Converter paths are workspace-confined. Model output has no arbitrary filesystem or Git authority. Secrets belong in environment/secret stores and never in brain repositories.

## Current release scope

The supported baseline includes Markdown, text-extractable documents, and the current web-conversion baseline through replaceable adapters. Features that have not been selected or validated for the current release are recorded only in [BACKLOG.md](BACKLOG.md).
