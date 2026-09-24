# ADR 0011: Use logical model roles behind a gateway

**Status:** Accepted
**Date:** 2026-09-24

## Context

OCR, semantic integration, cross-linking, and query have different model requirements. Hard-coding provider model IDs throughout the TypeScript codebase would couple architecture to one provider and make model evaluation difficult.

## Decision

Wikiplane uses logical roles such as `integrate`, `crosslink`, `query`, `ocr`, and optional `judge`.

A `ModelProvider` adapter targets an OpenAI-compatible model gateway. Concrete provider/model mappings are runtime configuration and evaluation outcomes, not core architecture.

## Consequences

- Model classes can be changed without editing compiler logic.
- Safeplane and Wikiplane can later share/extract gateway behavior after real common requirements are proven.
- OCR can use a small model while integration uses a stronger model.
- Cost/latency/quality evaluation is first-class project work.
