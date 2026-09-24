```text
      ██╗    ██╗ ██╗ ██╗  ██╗ ██╗ ██████╗ ██╗      █████╗  ███╗   ██╗ ███████╗
      ██║    ██║ ██║ ██║ ██╔╝ ██║ ██╔══██╗██║     ██╔══██╗ ████╗  ██║ ██╔════╝
      ██║ █╗ ██║ ██║ █████╔╝  ██║ ██████╔╝██║     ███████║ ██╔██╗ ██║ █████╗
      ██║███╗██║ ██║ ██╔═██╗  ██║ ██╔═══╝ ██║     ██╔══██║ ██║╚██╗██║ ██╔══╝
      ╚███╔███╔╝ ██║ ██║  ██╗ ██║ ██║     ███████╗██║  ██║ ██║ ╚████║ ███████╗
       ╚══╝╚══╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝ ╚═╝     ╚══════╝╚═╝  ╚═╝ ╚═╝  ╚═══╝ ╚══════╝

                      The local-first wiki for humans and agents

            structured knowledge · versioned pages · agent-ready · human-owned
```
Wikiplane turns source material into a durable, cross-referenced Markdown knowledge base stored in Git.

It is designed for two related uses:

- **agent memory** that can accumulate structured knowledge over time; and
- **human-browsable second brains** whose durable state is ordinary Markdown in a separate Git repository.

A caller gives Wikiplane a source reference. Wikiplane acquires and converts the source, stores a canonical Markdown transcription, integrates durable knowledge into the wiki, preserves provenance and contradictions, rebuilds navigation, validates the result, and commits the successful state atomically.

The source body stays in Wikiplane's data plane. Supervising agents and MCP clients use high-level operations and receive compact results instead of shuttling whole PDFs or converted documents through conversational context.

> **Project status:** active development. The core architecture and deterministic lifecycle are implemented. Live model-quality, OCR-quality, and web-adapter evaluations remain evidence-driven work before a stable public release.

## Why Wikiplane?

Most knowledge systems hide their useful state in a database, embedding index, or hosted service. Wikiplane intentionally makes **Markdown and Git the durable source of truth**.

That means a brain remains useful even without Wikiplane:

- clone it with Git;
- browse it on GitHub;
- inspect raw source transcriptions;
- follow normal Markdown links;
- inspect concepts, entities, and source pages;
- see exact source provenance;
- inspect history and diffs;
- rebuild derived navigation deterministically.

Vector indexes or caches may be added later, but they are never authoritative.

## How it works

```text
source reference
      │
      ▼
controlled acquisition
      │
      ▼
document/web adapter ──► OCR when needed
      │
      ▼
raw Markdown + provenance
      │
      ▼
semantic compiler
(source / concept / entity)
      │
      ├─ preserve contradictions
      └─ propose useful cross-links
      │
      ▼
deterministic rebuild + lint
      │
      ▼
atomic Git commit / push
      │
      ▼
compiled Markdown wiki
```

Models propose **structured mutations**. Deterministic application code owns filesystem and Git writes.

## Repository model

Wikiplane deliberately separates implementation from knowledge storage.

### System repository

This repository contains:

```text
packages/core/           adapted Microsoft LLM Wiki core
packages/application/    use cases and semantic lifecycle
packages/adapters/       Git, acquisition, converter, model adapters
packages/cli/            command-line interface
packages/mcp/            high-level MCP server
packages/testing/        fakes and adapter contract helpers
services/model-gateway/  OpenAI-compatible model boundary
services/markitdown/     MarkItDown + OCR conversion service
config/                  prompts, schema templates, runtime examples
evals/                   semantic/model evaluation scaffolding
docs/                    architecture and operational documentation
```

### Brain repository

A brain such as `wikiplane-data` is storage only:

```text
wikiplane-data/
├── README.md
├── AGENTS.md
├── raw/
│   └── <source>.md
└── wiki/
    ├── index.md
    ├── log.md
    ├── sources/
    ├── concepts/
    └── entities/
```

`raw/` contains durable Markdown transcriptions, not original PDFs or HTML. `wiki/` is the validated compiled knowledge state.

Runtime configuration, API keys, Docker files, package dependencies, and Wikiplane implementation do **not** belong in the brain repository.

## Core design decisions

Wikiplane follows these invariants:

1. **Markdown + Git are authoritative.**
2. **System code and brain data are separate repositories.**
3. **External tools sit behind Wikiplane-owned adapters.**
4. **Content hashes are not source identity.** Exact supplied remote references are the v1 identity key.
5. **Re-ingest should converge semantically** instead of causing representation churn.
6. **Contradictions are knowledge**, not ingestion failures.
7. **Models do not edit repositories directly.** They return structured mutations.
8. **Forward links favor precision.** Backlinks and indexes are derived.
9. **`rebuild` is deterministic and LLM-free. `recompile` is semantic and model-backed.**
10. **Failed operations do not produce gold commits.**

See [Architecture](ARCHITECTURE.md) and the [Architecture Decision Records](docs/adr/README.md) for the rationale behind these choices.

## Requirements

For local development:

- Node.js **22 or 24 LTS**; Node 24 is recommended by `.nvmrc`;
- Corepack;
- Python **3.11+**;
- Git;
- Docker with a running daemon for container tests and the Docker-first stack.

No global pnpm installation or global Python service packages are required.

## Bootstrap

Clone the repository and run:

```bash
scripts/bootstrap
```

This performs two local setup steps:

- `corepack pnpm install` using the pnpm version pinned in `package.json`;
- creation of `.venv` with both Python services and their test dependencies.

`corepack enable` is intentionally **not** required because system-managed Node installations may not permit creation of global symlinks under `/usr/local/bin`.

Create a local runtime configuration:

```bash
cp config/wikiplane.example.yaml wikiplane.yaml
```

Then point `brain.remote` at a separate brain repository.

## Test the repository

Run deterministic Node and Python tests:

```bash
tests/scripts/test-unit
```

Run repository formatting/lint/policy checks separately:

```bash
tests/scripts/test-quality
```

Run container build validation separately:

```bash
tests/scripts/test-docker
```

Docker validation requires a running Docker daemon. To run quality checks, unit tests, and the Docker build:

```bash
tests/scripts/test-all
```

See [Testing](docs/testing.md) for the test layers and live-evaluation policy.

## First local brain

With dependencies installed and `wikiplane.yaml` configured:

```bash
corepack pnpm wikiplane -- --config wikiplane.yaml brain init
```

Ingest a Markdown file:

```bash
corepack pnpm wikiplane -- --config wikiplane.yaml ingest ./notes/example.md
```

Inspect status and validate the brain:

```bash
corepack pnpm wikiplane -- --config wikiplane.yaml status
corepack pnpm wikiplane -- --config wikiplane.yaml lint
corepack pnpm wikiplane -- --config wikiplane.yaml rebuild --check
```

Query compiled wiki knowledge:

```bash
corepack pnpm wikiplane -- --config wikiplane.yaml query \
  "What does the brain say about this topic?"
```

## Remote document ingestion

PDF and other document conversion is provided through the MarkItDown service. OCR uses an OpenAI-compatible model endpoint through Wikiplane's model gateway.

For the Docker-first stack:

```bash
export WIKIPLANE_BRAIN_PATH=../wikiplane-data
docker compose up -d --build
```

The model gateway starts in `fake` mode by default for deterministic development. For live model calls, configure the gateway and logical model aliases through environment variables and the provided configuration examples.

Wikiplane core/application code never depends directly on OpenRouter, MarkItDown, or a Git hosting SDK. Those are replaceable adapter implementations.

## CLI

```text
wikiplane brain init
wikiplane ingest <url-or-file>
wikiplane source refresh <source-id>
wikiplane source remove <source-id>
wikiplane status
wikiplane lint
wikiplane rebuild
wikiplane rebuild --check
wikiplane recompile --all
wikiplane query "<question>"
```

All commands use `--config PATH` or `WIKIPLANE_CONFIG`.

## MCP

`packages/mcp` exposes high-level operations over the same application services used by the CLI:

- status;
- ingest;
- query;
- lint;
- rebuild;
- source removal;
- recompile.

MCP responses return compact structured results rather than whole source documents by default.

Run it locally with:

```bash
corepack pnpm mcp -- --config ./wikiplane.yaml
```

## Source identity and re-ingest

Wikiplane intentionally does **not** use a content hash to decide whether two transcriptions represent the same source.

For remote sources, the exact caller-supplied reference is the v1 lookup key. A refresh reacquires and reconverts that source. If the resulting durable transcription has not meaningfully changed, semantic compilation is skipped and no knowledge churn is produced. Git history retains prior transcriptions when a meaningful update does occur.

Different URLs are initially separate source records even if they happen to contain the same document. Cross-URL equivalence remains an explicit future experiment.

## Contradictions and provenance

If legitimate sources disagree, Wikiplane keeps both source-scoped claims and their provenance instead of silently selecting one. Concept and entity pages can therefore represent disagreements explicitly.

Exact supplied source links are retained. A resolved redirect target may also be recorded for diagnostics, but it does not replace caller-supplied provenance.

## Security model

Acquired content and model output are treated as untrusted. The implementation includes controlled remote acquisition, private/local network blocking, bounded redirects and download size, workspace-constrained converter paths, structured model output, deterministic validation, and transactional Git application.

For vulnerability reporting, see [SECURITY.md](SECURITY.md). The technical trust-boundary description lives in [docs/security-model.md](docs/security-model.md) and relevant ADRs.

## Documentation

Start here:

- [Architecture](ARCHITECTURE.md)
- [Architecture Decision Records](docs/adr/README.md)
- [Brain repository format](docs/brain-format.md)
- [Ingestion lifecycle](docs/ingestion.md)
- [Adapters](docs/adapters.md)
- [Models](docs/models.md)
- [Testing](docs/testing.md)
- [Security model](docs/security-model.md)
- [Upstream LLM Wiki import](docs/upstream-llmwiki-import.md)

The original implementation specification is retained under `docs/` for design history; ADRs capture the decisions that the implemented project now treats as durable architecture.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes to prompts, persistent schema, source identity, transaction semantics, or adapter contracts are architecture/compiler changes and should include focused regression tests and, where appropriate, an ADR update.

## Security

Please do not disclose vulnerabilities in public issues. See [SECURITY.md](SECURITY.md) for private reporting guidance.

## License and upstream attribution

Wikiplane's own code is MIT licensed. Copied/adapted third-party code retains its upstream notices and license information; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `third_party/`.
