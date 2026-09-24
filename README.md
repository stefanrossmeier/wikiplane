# Wikiplane

Wikiplane turns external source material into a structured, cross-referenced, queryable Markdown wiki stored in a separate Git repository. The source body stays in Wikiplane's data plane; callers use high-level operations and receive compact results.

The project starts from an adapted copy of Microsoft LLM Wiki core and adds controlled acquisition, replaceable document/web/model/Git adapters, MarkItDown + OCR, source-scoped semantic compilation, contradiction preservation, deterministic rebuild/lint, atomic Git transactions, query, CLI, MCP, and Docker-first runtime.

## Repository split

This repository is the **system**. A brain such as `wikiplane-data` is **storage only**:

```text
wikiplane-data/
├── README.md
├── AGENTS.md
├── raw/                 # durable Markdown source transcriptions
└── wiki/                # validated compiled knowledge
    ├── index.md
    ├── log.md
    ├── sources/
    ├── concepts/
    └── entities/
```

No original remote PDFs/HTML, runtime config, API keys, package dependencies, or Wikiplane implementation belong in the brain repository.

## Quick start

Requirements: Node 22, pnpm via Corepack, Git, Python 3.12 for the services, and Docker for the full stack.

```bash
corepack enable
pnpm install
cp config/wikiplane.example.yaml wikiplane.yaml

# Point brain.remote at the separate data repository.
pnpm wikiplane -- --config wikiplane.yaml brain init
pnpm wikiplane -- --config wikiplane.yaml ingest ./example.md
pnpm wikiplane -- --config wikiplane.yaml query "What did I ingest?"
```

For remote PDF/web ingestion start the supporting services or use the Compose stack:

```bash
export WIKIPLANE_BRAIN_PATH=../wikiplane-data
docker compose up -d --build

docker compose exec wikiplane \
  node packages/cli/dist/bin.js --config /app/config/docker.yaml \
  ingest 'https://arxiv.org/pdf/<paper-id>'
```

Compose starts the model gateway in `fake` mode by default. For real model calls set `MODEL_GATEWAY_MODE=real`, supply `OPENROUTER_API_KEY`, and configure logical aliases with `MODEL_ALIAS_WIKIPLANE_INTEGRATE`, `MODEL_ALIAS_WIKIPLANE_CROSSLINK`, `MODEL_ALIAS_WIKIPLANE_QUERY`, `MODEL_ALIAS_WIKIPLANE_OCR`, and optionally `MODEL_ALIAS_WIKIPLANE_JUDGE`. Concrete models are intentionally an evaluation result, not hard-coded architecture.

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

All commands accept `--config PATH` or `WIKIPLANE_CONFIG`.

## MCP

`packages/mcp` exposes only high-level tools: status, ingest, query, lint, rebuild, remove source, and recompile. It does not use MCP to shuttle whole converted documents between services.

```bash
pnpm mcp -- --config ./wikiplane.yaml
```

## Quality and safety

An ingest is performed in an isolated Git worktree. Only after semantic integration, deterministic rebuild, lint/provenance validation, and a successful commit does it become the branch's gold state. An unchanged re-ingest skips semantic model calls and creates no knowledge churn. No content hashes are used for source identity.

Remote acquisition is HTTP/HTTPS-only, blocks local/private destinations across redirects, applies timeout and streaming size limits, checks media types, and stores exact caller-supplied provenance. Model output is structured data applied by deterministic code rather than arbitrary repository edits.

See [ARCHITECTURE.md](ARCHITECTURE.md), [brain format](docs/brain-format.md), [ingestion](docs/ingestion.md), [adapters](docs/adapters.md), [models](docs/models.md), and [testing](docs/testing.md).

## Validation

```bash
pnpm ci
PYTHONPATH=services/model-gateway/src pytest -q services/model-gateway/tests
PYTHONPATH=services/markitdown/src pytest -q services/markitdown/tests
```

Live model/OCR/web quality evaluation is intentionally separate from deterministic PR CI; see `evals/` and `.github/workflows/model-eval.yml`.
