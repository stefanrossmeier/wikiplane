# ADR 0006: Models propose structured mutations

**Status:** Accepted
**Date:** 2026-09-24

## Context

The semantic compiler needs model judgment for create-vs-update decisions, concept/entity integration, contradiction handling, and cross-link candidates. Giving a model unrestricted filesystem or Git authority would enlarge the trust boundary and make validation difficult.

## Decision

Models return structured proposed mutations. Deterministic application code validates and applies those mutations to known page types and paths.

Models never receive unrestricted repository write, shell, or Git capabilities as part of normal compiler operation.

## Consequences

- Model output is untrusted input to a deterministic application layer.
- Persistent changes can be schema-validated before commit.
- Testing can distinguish semantic judgment from filesystem behavior.
- Prompt changes are compiler changes because they can alter proposed durable knowledge.
