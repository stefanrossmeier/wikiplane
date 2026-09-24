# Architecture Decision Records

This directory records decisions that define Wikiplane's durable architecture. The records distill the original implementation plan and Product & Architecture Requirements into decisions that correspond to the implemented system.

ADRs are historical records. When a decision changes, add a new ADR that supersedes the old one rather than silently rewriting the rationale.

## Status values

- **Accepted** — current architectural decision.
- **Proposed** — under evaluation and not yet a stable contract.
- **Superseded** — replaced by a later ADR.

## Index

| ADR                                                             | Decision                                                        | Status   |
| --------------------------------------------------------------- | --------------------------------------------------------------- | -------- |
| [0001](0001-markdown-and-git-are-authoritative.md)              | Markdown and Git are authoritative durable state                | Accepted |
| [0002](0002-separate-system-and-brain-repositories.md)          | Separate Wikiplane implementation from brain storage            | Accepted |
| [0003](0003-copy-and-adapt-llmwiki-core.md)                     | Copy and adapt Microsoft LLM Wiki core                          | Accepted |
| [0004](0004-external-capabilities-use-adapters.md)              | Put replaceable external capabilities behind adapters           | Accepted |
| [0005](0005-source-identity-does-not-use-content-hashes.md)     | Do not use content hashes for source identity/change semantics  | Accepted |
| [0006](0006-models-propose-structured-mutations.md)             | Models propose structured mutations; deterministic code writes  | Accepted |
| [0007](0007-preserve-contradictions.md)                         | Preserve contradictory source-backed claims                     | Accepted |
| [0008](0008-knowledge-operations-are-git-transactions.md)       | Knowledge-changing operations are atomic Git transactions       | Accepted |
| [0009](0009-rebuild-and-recompile-are-distinct.md)              | Separate deterministic rebuild from semantic recompile          | Accepted |
| [0010](0010-control-plane-and-data-plane-are-separated.md)      | Keep source bodies out of supervising-agent control flows       | Accepted |
| [0011](0011-use-logical-model-roles-behind-a-gateway.md)        | Use logical model roles behind an OpenAI-compatible gateway     | Accepted |
| [0012](0012-query-the-compiled-wiki-first.md)                   | Query compiled wiki content before raw sources                  | Accepted |
| [0013](0013-store-raw-markdown-not-remote-binaries.md)          | Store raw Markdown transcriptions, not original remote binaries | Accepted |
| [0014](0014-cross-links-favor-precision.md)                     | Favor precise authored links and derive backlinks               | Accepted |
| [0015](0015-web-converter-selection-remains-evidence-driven.md) | Keep web conversion pluggable until benchmark evidence exists   | Proposed |
