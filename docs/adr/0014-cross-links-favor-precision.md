# ADR 0014: Cross-links favor precision

**Status:** Accepted
**Date:** 2026-09-24

## Context

Automatically generated links can make a knowledge base either useful or noisy. High-recall linking creates weak relationships that reduce reader trust and make pages harder to navigate.

## Decision

Authored/generated forward links are added only when they are useful to a reader. Cross-link generation optimizes for precision. Reciprocal forward links are not automatic.

Backlinks are derived from the Markdown graph and can provide broader discovery without polluting authored content.

## Consequences

- A slightly under-linked wiki is preferable to a noisy one.
- Cross-link evaluation must penalize weak/unrelated links.
- Link targets are validated before writing.
- Backlinks/indexes remain rebuildable derived state.
