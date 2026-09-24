# ADR 0002: Separate system and brain repositories

**Status:** Accepted
**Date:** 2026-09-24

## Context

Implementation/runtime concerns and durable knowledge have different lifecycles, security needs, and portability requirements. Mixing Docker files, dependencies, prompts, and application code with private knowledge would make brains harder to browse, share, back up, and reason about.

## Decision

Wikiplane uses separate repositories:

- the **system repository** contains implementation, adapters, prompts, configuration examples, services, tests, and documentation;
- a **brain repository** contains only self-describing knowledge storage: `README.md`, `AGENTS.md`, `raw/`, and `wiki/`.

Runtime credentials and application dependencies never belong in the brain.

## Consequences

- A brain can be cloned and understood without the system repository.
- Wikiplane can evolve independently of a user's knowledge history.
- Private knowledge does not need to be present in the code repository.
- Schema conventions must be instantiated into the brain so it remains self-describing.
