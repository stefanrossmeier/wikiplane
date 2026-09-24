# ADR 0008: Knowledge-changing operations are Git transactions

**Status:** Accepted
**Date:** 2026-09-24

## Context

Ingestion performs several dependent steps: conversion, semantic integration, cross-linking, rebuild, lint, logging, commit, and possibly push. A failure midway must not corrupt the validated brain state.

## Decision

Knowledge-changing operations run in an isolated Git worktree/transaction. The operation is validated before it becomes the branch's committed gold state.

The initial default is one atomic commit per ingest operation.

## Consequences

- Failed validation produces no successful gold commit.
- Rollback is naturally aligned with Git history.
- Repository operations belong to Wikiplane, not downstream orchestrators such as Safeplane.
- Tests must cover clean baselines, worktree isolation, atomic commits, and push/rollback failure behavior.
