# AGENTS.md

This repository is a Wikiplane brain. It stores knowledge, not application code.

## Durable layout

- `raw/` contains canonical Markdown transcriptions of source material.
- `wiki/sources/` contains source records and provenance.
- `wiki/concepts/` contains durable concepts.
- `wiki/entities/` contains people, organizations, places, products, and other named things.
- `wiki/index.md` is deterministic derived navigation.
- `wiki/log.md` is the human-readable operation log.

## Page types

The v1 ontology is intentionally limited to `source`, `concept`, and `entity`.

Every wiki knowledge page must have YAML frontmatter with at least:

```yaml
id: string
type: source | concept | entity
title: string
```

Concept and entity pages may also contain:

```yaml
tags: string[]
sources: string[]
summary: string
created: ISO-8601
updated: ISO-8601
```

Source pages additionally retain the exact supplied provenance reference:

```yaml
source_url: string
resolved_url: string | null
source_path: string
retrieved_at: ISO-8601
adapter: string
adapter_version: string | null
```

## Source identity

Do not use content hashes for source identity or refresh semantics. For remote sources, the exact source reference supplied by the caller is the v1 lookup key. A source gets a stable internal `src_...` ID when first stored. Different URLs are separate source records unless a future migration explicitly establishes equivalence.

## Provenance and contradictions

Knowledge claims must remain attributable to their source records. Conflicting legitimate claims are preserved rather than silently resolved. A page may contain claims from multiple sources and an explicit `Contradictions` section.

## Links

Use ordinary relative Markdown links. Authored forward links should be useful and precision-oriented. Backlinks are derived at rebuild/query time and need not be manually mirrored.

## Generated state

`wiki/index.md` is derived. It must be reproducible without an LLM. Never place unique knowledge only in the index.
