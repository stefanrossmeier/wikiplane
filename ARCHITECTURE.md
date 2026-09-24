# Wikiplane Architecture

Wikiplane is a Git-native compiler for durable Markdown knowledge. The application repository owns acquisition, conversion, semantic integration, cross-linking, deterministic rebuild/lint, query, removal, Git transactions, adapters, and runtime configuration. A separate brain repository owns only durable Markdown state.

## Invariants

1. **Markdown and Git are authoritative.** Databases, embeddings, and indexes may only be disposable derived state.
2. **The brain is storage, not implementation.** It contains `README.md`, `AGENTS.md`, `raw/`, and `wiki/`, never runtime credentials or application dependencies.
3. **Control plane and data plane stay separate.** High-level callers exchange source references, source IDs, operation IDs, questions, and compact results. Document bodies move only inside Wikiplane-owned data-plane components.
4. **External capabilities are adapters.** Core/application code does not depend directly on MarkItDown, OpenRouter, a web extraction vendor, or GitHub SDKs.
5. **No content hashes define source identity or change semantics.** The exact caller-supplied remote reference is the v1 identity key. Local refresh uses the stable source ID/path relationship.
6. **Contradictions are retained.** Source-scoped claims permit multiple legitimate, incompatible claims to coexist with provenance.
7. **LLMs propose structured mutations; deterministic code writes files.** Models never receive unrestricted filesystem authority.
8. **Forward links optimize for precision; backlinks and indexes are derived.**
9. **`rebuild` is deterministic and LLM-free; `recompile` is semantic and model-backed.**
10. **An operation becomes gold only after rebuild/lint/validation and an atomic Git commit.** Failed operations leave the target branch unchanged.

## Repository layout

```text
wikiplane/                 system repository
  packages/core/           adapted Microsoft LLM Wiki core
  packages/application/    use cases, compiler, lifecycle
  packages/adapters/       concrete acquisition/Git/model/converter adapters
  packages/cli/            CLI over application services
  packages/mcp/            high-level MCP surface
  packages/testing/        fakes and reusable adapter contracts
  services/model-gateway/  OpenAI-compatible model boundary
  services/markitdown/     file/path based document conversion

wikiplane-data/            storage-only brain
  AGENTS.md
  raw/                     bronze: durable source Markdown
  wiki/                    gold: validated compiled knowledge
```

The temporary Git worktree, converter artifacts, and structured model output form the ephemeral silver stage.

## Ingest transaction

```text
source reference
  -> safe acquisition
  -> local artifact
  -> selected converter
  -> raw Markdown + exact provenance
  -> candidate retrieval
  -> structured integration mutations
  -> high-precision cross-link proposals
  -> deterministic rebuild
  -> lint/schema/provenance validation
  -> wiki/log.md
  -> atomic commit/push
  -> compact result
```

An unchanged source transcription skips semantic compilation. Changed transcriptions replace the durable `raw/` representation in the isolated worktree; Git preserves history.

## Trust boundaries

Internet content, converted text, and model output are untrusted. Acquisition blocks localhost/private/link-local/multicast destinations, follows bounded redirects, streams through a byte limit, validates content type, and never interpolates shell commands. Converter paths are constrained to the shared workspace. Models return JSON mutations which deterministic code validates before commit.

## Query

Query searches only compiled `wiki/` pages in v1, builds bounded lexical context, and asks the query model to answer from that context with wiki-path references. Raw source fallback is intentionally absent.

## Decision records

The durable rationale behind these invariants is recorded in [docs/adr/](docs/adr/README.md). The ADRs are the preferred place to document why an architectural constraint exists and how it may be superseded.

The technical trust-boundary description is maintained in [docs/security-model.md](docs/security-model.md); vulnerability reporting instructions are intentionally kept separately in [SECURITY.md](SECURITY.md).
