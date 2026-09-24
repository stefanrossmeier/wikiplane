# ADR 0009: Rebuild and recompile are distinct operations

**Status:** Accepted
**Date:** 2026-09-24

## Context

Some wiki state is deterministic navigation/hygiene, while other state is semantic model-generated knowledge. Treating them as one operation would make CI dependent on models and make recovery less predictable.

## Decision

`rebuild` is deterministic and LLM-free. It validates/recreates derived navigation, backlinks, and hygiene state.

`recompile` is semantic and model-backed. It reconstructs/integrates wiki knowledge from durable `raw/` Markdown.

## Consequences

- `rebuild --check` is suitable for deterministic CI.
- Deleting derived navigation should be recoverable without model access.
- Prompt/model/schema experiments use recompile rather than rebuild.
- Recompile must use a validated transaction and must not destroy current gold state before replacement is ready.
