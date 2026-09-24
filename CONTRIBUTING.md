# Contributing to Wikiplane

Thanks for helping improve Wikiplane. This project treats its architecture as part of its product contract: Markdown/Git durability, adapter boundaries, provenance, semantic stability, and transactional writes matter as much as feature behavior.

## Development prerequisites

Use:

- Node.js 22 or 24 LTS; Node 24 is the repository default in `.nvmrc`;
- Corepack;
- Python 3.11+;
- Git;
- Docker for container integration/build validation.

Do not install a global pnpm specifically for this repository. The pinned pnpm version is invoked through Corepack.

## Bootstrap

From a clean clone:

```bash
scripts/bootstrap
```

This installs Node workspace dependencies and creates a repository-local `.venv` containing both Python services plus their test dependencies.

You can run the steps independently:

```bash
scripts/bootstrap-node
scripts/bootstrap-python
```

`corepack enable` is intentionally unnecessary and may fail on system-managed Node installations that do not permit global symlink creation.

## Validation before a pull request

Run deterministic validation:

```bash
tests/scripts/test-unit
tests/scripts/test-quality
```

The unit entrypoint runs Node build/typecheck/Vitest plus both Python service suites. The quality entrypoint runs Prettier, ESLint, and repository policy checks.

If Docker is available and running, also run:

```bash
tests/scripts/test-docker
```

To run both:

```bash
tests/scripts/test-all
```

Live model and web-conversion quality evaluation is intentionally not part of normal pull-request CI. Use the `evals/` tooling when a change affects model behavior, semantic quality, or web extraction.

## Code organization

Keep responsibilities in their intended layer:

- `packages/core`: adapted Markdown/wiki primitives and preserved LLM Wiki core behavior;
- `packages/application`: domain lifecycle and use cases;
- `packages/adapters`: concrete external integrations;
- `packages/cli`: CLI surface only;
- `packages/mcp`: high-level MCP surface only;
- `services/model-gateway`: OpenAI-compatible logical model boundary;
- `services/markitdown`: isolated document conversion worker;
- `config/prompts`: versioned compiler prompts;
- `config/schema`: brain schema template;
- `docs/adr`: durable architecture decisions.

CLI and MCP code should remain thin. Domain logic belongs in application/core packages.

## Architecture rules

Changes must preserve these rules unless an ADR explicitly supersedes them:

1. Markdown and Git remain authoritative durable state.
2. The brain repository contains storage, not Wikiplane implementation/runtime configuration.
3. External services and tools are accessed through Wikiplane-owned ports/adapters.
4. Content hashes are not source identity or semantic-change semantics.
5. Exact caller-supplied source provenance is retained.
6. Contradictory legitimate claims are preserved with provenance.
7. Models return structured proposals; deterministic code owns repository writes.
8. `rebuild` remains deterministic and LLM-free.
9. Ingest/removal/recompile changes become gold only through validated Git transactions.
10. Supervising callers do not need source bodies merely to orchestrate Wikiplane.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [docs/adr/README.md](docs/adr/README.md).

## Tests and change types

Add focused regression tests for behavior changes. In particular:

- adapter changes should satisfy reusable adapter contracts;
- source identity changes require re-ingest stability tests;
- removal changes require multi-source support tests;
- rebuild changes require deterministic `--check` tests;
- Git lifecycle changes require rollback/atomicity tests;
- prompt/compiler changes require semantic golden cases;
- acquisition changes require security-boundary tests.

Avoid exact prose snapshots for model-generated knowledge unless the format itself is deterministic and intentionally under test.

## Prompt and schema changes

Prompts under `config/prompts/` are compiler code because they can change durable knowledge. Version them deliberately and add semantic regression coverage.

`config/schema/AGENTS.template.md` is the authoritative brain schema template. Schema changes require explicit migration/compatibility consideration; ingestion must never treat a brain's `AGENTS.md` as source material.

## Architecture Decision Records

Create or update an ADR when a change alters a durable project decision such as:

- storage authority;
- repository boundaries;
- source identity;
- adapter contracts;
- Git transaction semantics;
- compiler authority;
- model-provider boundaries;
- rebuild/recompile behavior;
- query philosophy.

Use the format already present in `docs/adr/` and mark superseded records instead of rewriting history.

## Security-sensitive changes

Treat remote source content, converted content, and model output as untrusted. Do not weaken URL validation, path confinement, structured mutation validation, or transactional commit checks without explicit security review.

Never commit:

- provider/API keys;
- real private brain contents;
- downloaded source binaries;
- operation worktrees/artifacts;
- raw prompt/document telemetry;
- local `.env` files containing secrets.

Security vulnerabilities should be reported according to [SECURITY.md](SECURITY.md), not discussed in a public issue first.

## Third-party code and licensing

Copied/adapted code must retain the required upstream license and notices. Do not copy strong-copyleft implementation code into the MIT codebase without an explicit licensing decision. Keep `THIRD_PARTY_NOTICES.md` and `third_party/` provenance current when vendoring code.

## Pull requests

A useful pull request should explain:

- the problem being solved;
- the architectural surface affected;
- tests/evals added or run;
- persistent brain-format impact, if any;
- compatibility/migration concerns, if any;
- related ADR changes for architectural decisions.

Prefer small reviewable commits where possible. Large upstream imports should remain separable from adaptations so provenance stays auditable.

### Test and quality gates

`tests/scripts/test-unit` verifies behavior and compilation. `tests/scripts/test-quality` verifies formatting, lint, and repository policy. Run both before opening a pull request; `tests/scripts/test-all` additionally verifies the Docker build.
