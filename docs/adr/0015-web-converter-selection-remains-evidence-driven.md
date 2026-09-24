# ADR 0015: Web converter selection remains evidence-driven

**Status:** Proposed
**Date:** 2026-09-24

## Context

Web extraction quality varies significantly across static articles, documentation, GitHub pages, JS-heavy sites, noisy navigation, code blocks, tables, redirects, and blocked pages. Licensing and operational complexity also differ across available tools.

## Decision

Do not make one web-extraction implementation a permanent architectural dependency before comparative evaluation.

The `WebConverter` boundary remains stable while candidate implementations are benchmarked for content quality, Markdown structure, safety, dynamic-page support, latency, operational complexity, and licensing.

MarkItDown HTML may serve as a baseline/fallback during development, but default selection remains an evaluation outcome.

## Consequences

- Web extraction remains replaceable.
- Strong-copyleft services can remain separate rather than being copied into the MIT codebase without an explicit licensing decision.
- The benchmark corpus and results should be retained as project evidence.
- This ADR should become Accepted or be superseded when a default adapter is selected from measured results.
