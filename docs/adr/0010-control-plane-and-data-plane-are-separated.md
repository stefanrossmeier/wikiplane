# ADR 0010: Control plane and data plane are separated

**Status:** Accepted
**Date:** 2026-09-24

## Context

A supervising agent needs to request operations and report outcomes, but it does not need to consume every PDF, OCR page, converted document, or wiki page merely to orchestrate ingestion.

Moving large documents through MCP or conversational tool results increases token cost and unnecessarily expands the information boundary.

## Decision

High-level callers exchange compact control-plane values such as source references, source IDs, operation IDs, questions, and result summaries.

Large source bodies, converter artifacts, specialist model context, and proposed mutations remain inside Wikiplane's data plane and are exchanged through files/paths/artifact handles where practical.

## Consequences

- MCP exposes high-level operations rather than low-level file-edit primitives.
- Supervising agents remain token-efficient.
- Specialist compiler/model components may read source content because that is their job.
- Tool APIs should avoid returning whole documents by default.
