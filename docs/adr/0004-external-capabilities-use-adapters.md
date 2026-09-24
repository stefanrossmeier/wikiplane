# ADR 0004: External capabilities use adapters

**Status:** Accepted
**Date:** 2026-09-24

## Context

Document conversion, OCR, model providers, web extraction, acquisition, and Git hosting may change over time. Letting semantic compiler logic import provider-specific libraries would turn implementation choices into architecture lock-in.

## Decision

Core/application code depends on Wikiplane-owned ports such as:

- `SourceAcquirer`;
- `DocumentConverter`;
- `WebConverter`;
- `OcrProvider`;
- `ModelProvider`;
- `RepositoryProvider`.

Concrete implementations live behind those boundaries.

## Consequences

- MarkItDown, the model gateway, web extractors, and repository implementations are replaceable.
- Adapter implementations can have reusable contract tests.
- Provider-specific configuration remains outside semantic compiler logic.
- Interfaces should remain narrow and artifact/path oriented rather than moving large source bodies through control-plane calls.
