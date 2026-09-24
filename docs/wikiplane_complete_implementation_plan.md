# Wikiplane — Complete Implementation Plan

**Status:** implementation in progress — core product implementation present; live/evidence gates remain
**Working project name:** Wikiplane  
**Primary implementation language:** TypeScript  
**Primary storage:** separate private Git repository containing Markdown  
**Initial upstream basis:** Microsoft `llmwiki` core, copied under the MIT license and adapted in-place  
**Runtime approach:** Docker-first  
**Orchestration boundary:** Wikiplane owns knowledge operations; Safeplane later owns when/how Wikiplane is invoked

---

## Implementation status — 2026-09-24

Checkboxes below record **implemented repository work**, while acceptance gates that require unavailable live providers, model-quality evidence, Docker execution, or external GitHub state remain unchecked.

- [x] Phase 0 — repository/tooling/governance files and CI definition implemented. Repository privacy is external GitHub state.
- [ ] Phase 1 — LLM Wiki core imported/adapted and regression tests retained; full Node suite still needs execution after dependency installation.
- [x] Phase 2 — adapter ports, fakes, and reusable contract suites implemented.
- [x] Phase 3 — validated Wikiplane configuration and secret boundaries implemented.
- [x] Phase 4 — root-level storage-only brain lifecycle and `brain init` implemented.
- [x] Phase 5 — Git worktree transaction engine with rollback/isolation semantics implemented.
- [x] Phase 6 — stable source IDs, exact supplied-reference lookup, provenance, and no-hash semantics implemented.
- [x] Phase 7 — end-to-end Markdown ingestion path implemented with convergence tests.
- [x] Phase 8 — copied model gateway adapted behind `ModelProvider`; text/JSON/multimodal passthrough unit-verified.
- [ ] Phase 9 — model evaluation harness exists, but real model assignments require live comparative evidence.
- [ ] Phase 10 — MarkItDown/OCR worker and gateway wiring implemented/unit-verified; normal + scanned synthetic PDF fixtures are present; live OCR/model quality acceptance still pending.
- [x] Phase 11 — controlled acquisition with scheme, SSRF, redirects, timeout, streaming size, media-type, and filename protections implemented.
- [x] Phase 12 — structured semantic compiler with bounded candidate context and deterministic filesystem authority implemented.
- [x] Phase 13 — source-scoped contradiction preservation and removal reevaluation implemented with deterministic test coverage.
- [x] Phase 14 — precision-oriented model cross-link pass with target validation implemented.
- [x] Phase 15 — deterministic rebuild, stale-state check, backlinks calculation, schema/provenance lint implemented.
- [ ] Phase 16 — deterministic unchanged-source convergence is covered; full OCR/converter drift thresholds still require golden/live evaluation.
- [ ] Phase 17 — MarkItDown HTML baseline is implemented; comparative web-adapter benchmark/default selection is intentionally pending evidence.
- [x] Phase 18 — gold-wiki-first lexical retrieval/query with bounded model context and source references implemented.
- [x] Phase 19 — source removal preserves independently supported knowledge, repairs links, and removes invalidated contradictions.
- [x] Phase 20 — human operation log plus out-of-brain JSONL operation telemetry implemented without body/prompt logging.
- [x] Phase 21 — stable CLI over the application service implemented.
- [x] Phase 22 — high-level MCP server implemented; source bodies are not returned as transport payloads.
- [ ] Phase 23 — Docker-first three-service stack is defined with health checks/network/volume boundaries; full Compose E2E execution pending.
- [ ] Phase 24 — deterministic/unit/contract/service tests and eval scaffolding implemented; full Node/Docker/live golden suite execution pending.
- [x] Phase 25 — PR CI plus separate manually triggered model-eval workflow defined.
- [ ] Phase 26 — `wikiplane-data` is initialized as a storage-only brain; GitHub privacy/push and first controlled real ingest require user-side execution.
- [ ] Phase 27 — PDF vertical-slice code path exists, but live PDF deep-link E2E acceptance remains pending.
- [ ] Phase 28 — corpus structure and initial convergence golden case exist; full 20-case semantic corpus remains pending.
- [x] Phase 29 — safe transaction-scoped full recompile from durable raw Markdown implemented.
- [ ] Phase 30 — Safeplane integration intentionally deferred until Wikiplane acceptance gates pass.
- [ ] Phase 31 — public-release review intentionally pending live evals, exact Safeplane import SHA recovery, and release evidence.

## 1. Objective

Build **Wikiplane**, a reusable Git-native capability that turns external source material into a structured, cross-referenced, queryable Markdown wiki.

The implementation must keep three concerns separate:

1. **Wikiplane system repository**
   - implementation
   - adapters
   - model access
   - ingestion
   - cross-referencing
   - index building
   - linting
   - query
   - Git transactions
   - configuration
   - Docker services

2. **Brain/wiki data repository**
   - private Git repository
   - storage only
   - converted source Markdown in `raw/`
   - generated/interlinked knowledge in `wiki/`
   - exact source provenance
   - schema/conventions required to make the stored wiki self-describing
   - no application implementation
   - no secrets
   - no original PDF/HTML binaries

3. **Safeplane integration**
   - implemented only after Wikiplane is stable
   - owns workflow-level orchestration and user intent
   - calls high-level Wikiplane operations
   - never needs to read the PDF, HTML, converted Markdown, or full wiki pages just to orchestrate ingestion

The intended user experience is:

```text
User:
  "Ingest https://arxiv.org/pdf/...."

Safeplane:
  calls Wikiplane with the source reference

Wikiplane:
  acquire
  -> convert
  -> store raw Markdown
  -> integrate
  -> cross-reference
  -> rebuild indexes
  -> lint
  -> commit
  -> push

Safeplane receives:
  compact structured result only
```

Documents flow through the **data plane**. Agents use a small **control plane**.

---

## 2. Architectural principles

These principles should be written into `ARCHITECTURE.md` early and treated as invariants.

### 2.1 Markdown and Git are the durable state

The brain repository must remain useful if Wikiplane disappears.

A human must be able to:

- clone the brain repository;
- browse it on GitHub;
- read source transcriptions;
- navigate ordinary Markdown links;
- inspect generated concepts/entities;
- inspect Git history;
- understand the stored schema.

Do not make SQLite, a vector database, a hidden service, or an embedding index authoritative.

Derived caches may be added later, but they must be disposable.

### 2.2 The brain repository is storage, not implementation

The brain repository must not contain:

- Wikiplane source code;
- Safeplane workflows;
- model gateway implementation;
- adapter implementation;
- runtime credentials;
- Docker Compose;
- package dependencies.

It may contain the stored wiki's schema/conventions when needed to keep the repository self-describing.

### 2.3 Wikiplane owns its inner workings

Wikiplane owns:

- acquisition;
- adapters;
- canonical Markdown conversion;
- source registration;
- LLM calls needed by knowledge maintenance;
- source/concept/entity integration;
- contradiction preservation;
- cross-reference generation;
- index building;
- linting;
- removal semantics;
- query/retrieval;
- Git transaction handling;
- observability;
- configuration.

Safeplane must not reproduce those steps.

### 2.4 Safeplane owns usage policy

Safeplane later owns:

- deciding that a Wikiplane workflow should run;
- receiving user input;
- selecting which configured brain to operate on;
- workflow-level authorization/approval where needed;
- reporting the compact outcome.

The preferred call is conceptually:

```text
wikiplane.ingest(source_reference)
```

not a series of low-level page-edit calls.

### 2.5 External tools are always behind Wikiplane-owned adapters

Wikiplane core must not directly depend on:

- MarkItDown;
- MarkItDown OCR;
- Safe Web Research;
- Firecrawl;
- Crawl4AI;
- markfetch;
- Jina Reader;
- OpenRouter;
- the Safeplane model gateway;
- a specific Git hosting SDK.

Core code depends on Wikiplane interfaces. Concrete adapters are replaceable.

### 2.6 No content hashes as source identity or change semantics

Do not use a hash of a PDF, HTML page, or converted Markdown to decide source identity.

Reasons:

- transcriptions are not guaranteed to be byte-stable;
- converter versions may change formatting;
- OCR may change slightly across versions/models;
- equivalent semantic content may produce a different transcription;
- Wikiplane should optimize for semantic stability, not byte stability.

The quality expectation is:

> Re-ingesting the same source, or a slightly different transcription of the same source, should converge on essentially the same wiki state and should cause minimal semantic churn.

This must be tested directly.

### 2.7 Exact source references are retained

If the user supplies:

```text
https://arxiv.org/pdf/2609.24972
```

the stored provenance must retain that exact deep link.

Do not reduce it to:

```text
https://arxiv.org
```

Redirect targets may be stored additionally for diagnostics, but they must not replace the supplied reference.

### 2.8 Contradictions are knowledge

When two legitimate sources disagree, Wikiplane must preserve the disagreement.

Do not silently select one source and rewrite the wiki as though the other claim never existed.

A concept/entity page should be able to express:

- source A states X;
- source B states Y;
- these claims conflict or apply under different conditions;
- provenance for both claims.

### 2.9 Cross-link for precision

Prefer fewer meaningful links over many weak links.

Computed backlinks and query/retrieval can provide broader discovery. Authored forward links should have semantic value.

### 2.10 Rebuild and recompile are different operations

`rebuild`:

- deterministic;
- no LLM required;
- regenerates indexes/navigation/backlinks and performs hygiene.

`recompile`:

- semantic;
- uses LLMs;
- reconstructs or re-integrates wiki knowledge from `raw/`.

### 2.11 Silver and gold are lifecycle concepts, not duplicate directories

Use the medallion architecture as a mental model:

```text
raw/  = bronze
temporary worktree + proposed wiki changes = silver
validated committed wiki state = gold
```

Do not create permanent `silver/` and `gold/` directory copies.

---

## 3. Target system architecture

```text
                         ┌─────────────────────┐
                         │      Safeplane      │
                         │  later integration  │
                         └──────────┬──────────┘
                                    │
                         high-level control call
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                         Wikiplane                           │
│                                                             │
│  Application services                                      │
│  ├─ ingest                                                 │
│  ├─ refresh/re-ingest                                      │
│  ├─ remove source                                          │
│  ├─ rebuild                                                │
│  ├─ recompile                                              │
│  ├─ query                                                  │
│  └─ status/lint                                            │
│                                                             │
│  Core / adapted LLM Wiki                                   │
│  ├─ raw source handling                                    │
│  ├─ source pages                                           │
│  ├─ concepts/entities                                      │
│  ├─ cross-links/backlinks                                  │
│  ├─ index                                                  │
│  ├─ log                                                    │
│  └─ lint                                                   │
│                                                             │
│  Adapter ports                                             │
│  ├─ SourceAcquirer                                         │
│  ├─ WebConverter                                           │
│  ├─ DocumentConverter                                      │
│  ├─ OcrProvider                                            │
│  ├─ ModelProvider                                          │
│  └─ RepositoryProvider                                     │
└──────┬─────────────────┬─────────────────┬──────────────────┘
       │                 │                 │
       ▼                 ▼                 ▼
 MarkItDown          model-gateway      web adapter
 + OCR worker         container        implementation
       │                 │
       └────────────┬────┘
                    ▼
                 OpenRouter

                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ private brain repo  │
                         │                     │
                         │ raw/                │
                         │ wiki/               │
                         │ AGENTS.md           │
                         └─────────────────────┘
```

---

## 4. Repository model

### 4.1 Wikiplane system repository

Create a new private repository first.

Suggested initial structure:

```text
wikiplane/
├── README.md
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── SECURITY.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.*
├── .gitignore
├── .editorconfig
├── .env.example
│
├── config/
│   ├── wikiplane.example.yaml
│   ├── prompts/
│   │   ├── integrate/
│   │   ├── crosslink/
│   │   ├── query/
│   │   └── contradiction/
│   └── schema/
│       └── AGENTS.template.md
│
├── packages/
│   ├── core/
│   ├── application/
│   ├── adapters/
│   ├── cli/
│   ├── mcp/
│   └── testing/
│
├── services/
│   ├── model-gateway/
│   └── markitdown/
│
├── evals/
│   ├── corpus/
│   ├── golden/
│   ├── judges/
│   └── reports/
│
├── examples/
│   ├── config/
│   └── synthetic-brain/
│
├── docs/
│   ├── brain-format.md
│   ├── adapters.md
│   ├── ingestion.md
│   ├── models.md
│   ├── testing.md
│   └── upstream-llmwiki-import.md
│
├── docker-compose.yml
├── docker-compose.test.yml
└── .github/
    └── workflows/
```

Prefer a monorepo workspace, but keep the number of packages low until a package boundary has a real purpose.

### 4.2 Brain/wiki data repository

The first real brain must be a separate private repository.

Initial layout:

```text
brain/
├── README.md
├── AGENTS.md
│
├── raw/
│   ├── <source-a>.md
│   ├── <source-b>.md
│   └── ...
│
└── wiki/
    ├── index.md
    ├── log.md
    ├── sources/
    ├── concepts/
    ├── entities/
    └── ...
```

Start by preserving the LLM Wiki physical layout as closely as practical.

Do not add runtime config to the brain repository.

### 4.3 `AGENTS.md`

Wikiplane owns the authoritative schema template:

```text
wikiplane/config/schema/AGENTS.template.md
```

A compatible `AGENTS.md` is instantiated into the brain repository to make the stored wiki self-describing and to preserve the LLM Wiki schema philosophy.

Rules:

- Wikiplane owns schema evolution;
- the brain stores the active schema/conventions;
- schema changes happen through explicit migration/update logic;
- ingestion must never treat `AGENTS.md` as a source document.

---

## 5. Phase 0 — Project creation and baseline governance

### Tasks

1. Create a new private GitHub repository named `wikiplane`.
2. Initialize TypeScript/Node tooling.
3. Choose a supported Node LTS version and pin it.
4. Use `pnpm` workspaces unless there is a strong reason not to.
5. Add MIT license for new Wikiplane code.
6. Add `THIRD_PARTY_NOTICES.md`.
7. Add security policy.
8. Add contribution/testing conventions.
9. Add minimal CI:
   - install;
   - typecheck;
   - unit test;
   - lint.
10. Create `ARCHITECTURE.md` containing the principles in this plan.
11. Create `docs/brain-format.md`.
12. Create initial `wikiplane.example.yaml`.

### Suggested initial commands

```bash
mkdir wikiplane
cd wikiplane
git init

pnpm init

gh repo create <owner>/wikiplane \
  --private \
  --source=. \
  --remote=origin \
  --push
```

Adjust commands to the actual GitHub account/org.

### Acceptance gate

- repository is private;
- CI runs on the first commit;
- no Safeplane implementation code exists in Wikiplane;
- architecture explicitly separates system repo and data repo.

---

## 6. Phase 1 — Import the LLM Wiki core

The goal of this phase is to establish a behaviorally equivalent copied core before changing it.

### 6.1 Pin the upstream source

Record:

- upstream URL: `https://github.com/microsoft/llmwiki`;
- exact upstream commit SHA used;
- import date;
- source paths copied;
- license.

Store this in:

```text
docs/upstream-llmwiki-import.md
```

### 6.2 Copy, do not depend

Do **not** add `@llmwiki/core` as a runtime dependency.

Clone upstream temporarily, checkout the exact selected commit, then copy the complete useful core package into:

```text
packages/core/
```

Copy:

- core source;
- core tests;
- fixtures needed by those tests;
- relevant package dependencies;
- schemas/templates that core behavior requires.

Do not copy:

- VS Code extension implementation;
- VS Code commands;
- tree views;
- Copilot UI integration;
- extension packaging;
- VS Code language-model integration.

### 6.3 Preserve licensing

Add:

```text
third_party/
└── llmwiki/
    └── LICENSE
```

or an equivalent retained-license location.

Document imported code in `THIRD_PARTY_NOTICES.md`.

Preserve copyright/license headers when present.

### 6.4 Make the import its own commit

Preferred history:

```text
chore: initialize wikiplane repository
chore: import microsoft llmwiki core at <sha>
```

Do not combine large adaptation changes with the import commit.

### 6.5 Run the copied test suite unchanged first

Before modifying behavior:

- install dependencies;
- make copied unit tests run;
- establish a baseline;
- record skipped/incompatible tests;
- only modify tests where an assumption genuinely belongs to VS Code rather than core.

### Acceptance gate

- copied core runs without a runtime dependency on `@llmwiki/core`;
- copied core tests are green or explicitly documented;
- no VS Code runtime dependency remains in core;
- MIT attribution is present;
- the imported behavior can initialize/read/write/lint a fixture wiki.

---

## 7. Phase 2 — Create Wikiplane ports and application boundaries

Before adding converters or providers, define stable Wikiplane interfaces.

### 7.1 Core rule

`packages/core` must not import any external service-specific adapter.

Application code depends on ports.

### 7.2 Define adapter contracts

At minimum:

```ts
interface SourceAcquirer {
  acquire(request: AcquireRequest): Promise<AcquiredArtifact>;
}

interface DocumentConverter {
  supports(artifact: AcquiredArtifact): boolean;
  convert(artifact: AcquiredArtifact): Promise<ConvertedSource>;
}

interface WebConverter {
  convert(request: WebConversionRequest): Promise<ConvertedSource>;
}

interface OcrProvider {
  transcribe(request: OcrRequest): Promise<OcrResult>;
}

interface ModelProvider {
  complete(request: ModelRequest): Promise<ModelResponse>;
}

interface RepositoryProvider {
  open(target: RepositoryTarget): Promise<RepositorySession>;
}
```

Do not over-design exact types before the first implementation; keep them narrow.

### 7.3 Opaque artifact paths, not model context

Adapters should return handles/paths/metadata.

Bad:

```text
convert_pdf(...) -> giant Markdown response passed through an agent
```

Good:

```text
acquire(url) -> artifact handle
convert(artifact) -> converted source path + metadata
```

The application service reads/writes files directly.

### 7.4 Add adapter contract tests

Create reusable test suites:

```text
packages/testing/
└── contracts/
    ├── source-acquirer.contract.ts
    ├── document-converter.contract.ts
    ├── web-converter.contract.ts
    ├── model-provider.contract.ts
    └── repository-provider.contract.ts
```

Every future adapter implementation must pass its contract.

### Acceptance gate

- core compiles without concrete tool imports;
- at least one fake/in-memory implementation exists for every required port;
- contract tests are reusable.

---

## 8. Phase 3 — Configuration

Wikiplane owns runtime configuration.

The brain repository does not.

### Suggested config

```yaml
brain:
  remote: git@github.com:<owner>/<brain-repo>.git
  branch: main
  workspace_root: /var/lib/wikiplane/workspaces

git:
  author_name: Wikiplane
  author_email: wikiplane@local
  push: true

adapters:
  document: markitdown
  web: experimental
  ocr: markitdown-ocr

models:
  endpoint: http://model-gateway:8000
  roles:
    integrate: wikiplane-integrate
    crosslink: wikiplane-crosslink
    query: wikiplane-query
    ocr: wikiplane-ocr

ingest:
  preserve_supplied_source_reference: true
  retain_original_artifact: false

logging:
  level: info
  retain_prompt_bodies: false
  retain_document_bodies: false
```

Exact names may change after the copied model gateway is inspected.

### Secrets

Secrets must come from:

- environment variables;
- Docker secrets;
- local secret management;
- CI secret store.

Never write provider API keys to:

- brain repository;
- `wikiplane.yaml`;
- log files.

### Acceptance gate

- config validates against a schema;
- bad config fails before an ingest starts;
- config is never scanned or ingested as knowledge.

---

## 9. Phase 4 — Brain repository lifecycle

Wikiplane owns the data repository lifecycle.

### 9.1 Implement `wikiplane brain init`

Responsibilities:

1. create or clone target repository;
2. create `raw/`;
3. create `wiki/`;
4. initialize LLM Wiki-compatible structure;
5. instantiate `AGENTS.md`;
6. initialize `wiki/index.md`;
7. initialize `wiki/log.md`;
8. create human-readable `README.md`;
9. validate;
10. create initial Git commit;
11. optionally push.

### 9.2 Brain README

The root README should make GitHub browsing useful immediately.

Example:

```markdown
# My Brain

- [Wiki index](wiki/index.md)
- [Concepts](wiki/concepts/)
- [Entities](wiki/entities/)
- [Sources](wiki/sources/)
- [Raw source transcriptions](raw/)
- [Operation log](wiki/log.md)
```

### 9.3 Git ownership

Wikiplane owns:

- clone/fetch;
- worktrees;
- staging;
- commits;
- push;
- rollback on failure.

Safeplane should not need to know how this is implemented.

### Acceptance gate

From an empty directory:

```bash
wikiplane brain init ...
```

produces a valid, browsable data-only repository.

---

## 10. Phase 5 — Git transaction engine

Do this before autonomous LLM writes.

### Required workflow

```text
fetch target branch
    ↓
ensure clean baseline
    ↓
create temporary worktree / operation branch
    ↓
perform entire operation
    ↓
rebuild
    ↓
lint
    ↓
validate
    ↓
commit
    ↓
push
    ↓
destroy temporary worktree
```

On failure:

```text
no successful validation
    => no gold commit
```

Preserve an operational error record outside the brain if needed.

### Commit semantics

Default:

> One ingest operation produces at least one atomic Git commit.

Start with exactly one commit per ingest unless implementation evidence shows a reason to split it.

Suggested message:

```text
feat(knowledge): ingest <source title>
```

### Acceptance gate

An intentionally failing ingest leaves the target branch unchanged.

---

## 11. Phase 6 — Source identity and provenance without hashes

### 11.1 Remote source identity

For v1:

- use the exact supplied source reference as the lookup key for re-ingest;
- assign a stable internal source ID when first stored;
- do not derive identity from content hashes.

Example source frontmatter:

```yaml
---
id: src_01...
type: source
title: Example Paper
source_url: https://arxiv.org/pdf/2609.24972
resolved_url: https://arxiv.org/pdf/2609.24972
retrieved_at: 2026-09-24T12:00:00Z
adapter: markitdown
adapter_version: 1.x
---
```

Do not make the filename itself the only identity.

### 11.2 Re-ingest

When the exact source reference already exists:

1. reacquire;
2. reconvert;
3. replace/update the current `raw/` transcription in the transactional worktree;
4. re-integrate;
5. expect semantic convergence;
6. lint;
7. commit only meaningful resulting changes.

Git already preserves previous raw transcriptions.

### 11.3 Different URLs containing the same document

Initially treat them as separate source records.

Do not attempt global source equivalence before evidence shows it is necessary.

The knowledge integration layer should still avoid duplicate concepts/entities.

### 11.4 Local uploads

For files without a durable external reference:

- create a stable internal source ID;
- retain user-provided filename and provenance metadata;
- define re-ingest/update behavior through explicit source ID.

### Acceptance gate

Re-ingesting the same source does not create a second source record or duplicate concepts/entities.

---

## 12. Phase 7 — Markdown adapter first

Implement the simplest complete source path before PDF/web work.

### Workflow

```text
Markdown input
   ↓
normalize metadata
   ↓
write/update raw/<source>.md
   ↓
LLM Wiki ingest/integration
   ↓
wiki
   ↓
rebuild + lint
   ↓
commit
```

### Tests

- empty brain + one Markdown source;
- same Markdown source twice;
- trivially reformatted Markdown source;
- two Markdown sources describing the same concept;
- two sources containing contradictory claims.

### Acceptance gate

Wikiplane can fully ingest a Markdown source end-to-end without any document converter.

---

## 13. Phase 8 — Copy and integrate the Safeplane model gateway

The Safeplane model gateway is the preferred starting point.

### 13.1 Copy, then extract later

Copy:

```text
safeplane/services/model-gateway
```

into:

```text
wikiplane/services/model-gateway
```

for now.

Do not create a shared project before two consumers have proven the real common interface.

Track:

- original Safeplane commit SHA;
- copied files;
- license;
- adaptations.

### 13.2 Inspect before adaptation

Verify the copied gateway supports:

- OpenAI-compatible HTTP API;
- OpenRouter upstream;
- configurable model aliases;
- multimodal/image input passthrough;
- structured/JSON output if needed;
- retries/timeouts;
- useful error propagation;
- no Safeplane-specific request assumptions;
- safe logging defaults;
- token/usage metadata where available.

### 13.3 Add `ModelProvider` adapter

Wikiplane TypeScript code calls only:

```text
ModelProvider
```

The first concrete adapter points to the gateway.

No Wikiplane core code imports OpenRouter-specific code.

### 13.4 Logical model roles

Start with:

```text
integrate
crosslink
query
ocr
```

Potentially add:

```text
judge
```

for evaluation only.

Do not hard-code concrete provider model IDs throughout the codebase.

### 13.5 Later extraction

After Wikiplane proves the shared requirements:

```text
Safeplane ─┐
           ├── standalone model-gateway project
Wikiplane ─┘
```

Treat this as a later refactor, not a blocker.

### Acceptance gate

A TypeScript smoke test can call the gateway through `ModelProvider` and receive a valid structured response.

---

## 14. Phase 9 — Model evaluation

Do not select expensive models by intuition.

Evaluate the smallest model that satisfies each role.

### 14.1 Roles

#### OCR

Expected capability:

- faithful transcription;
- layout awareness;
- tables;
- mixed German/English;
- academic PDFs;
- minimal reasoning.

Start with small/cheap vision models.

Use stronger fallback only when necessary.

#### Integration

Expected capability:

- extract durable knowledge;
- decide create vs update;
- merge into existing concepts/entities;
- preserve contradiction;
- avoid unnecessary page churn;
- return structured mutations reliably.

This likely needs a stronger model than OCR.

#### Cross-link

Expected capability:

- judge whether a relationship is genuinely useful;
- optimize for precision.

#### Query

Expected capability:

- answer from gold wiki content;
- cite/link relevant stored pages/sources;
- avoid falling back to raw unless explicitly permitted.

### 14.2 Evaluation matrix

Test at least:

- cheap/small model;
- medium expert model;
- stronger model.

Measure:

- correctness;
- stability;
- duplication;
- contradiction handling;
- cross-link precision;
- latency;
- cost.

### Acceptance gate

Concrete model assignments are backed by evaluation results, not preference.

---

## 15. Phase 10 — MarkItDown adapter service

Use MarkItDown behind a Wikiplane adapter.

### 15.1 Container

Create:

```text
services/markitdown/
├── Dockerfile
├── requirements/pyproject
├── worker code
└── tests
```

Include:

- MarkItDown;
- MarkItDown OCR plugin;
- OpenAI-compatible client configuration for OCR;
- only the conversion features needed by Wikiplane.

### 15.2 Invocation model

Prefer a job/worker interface that exchanges files/paths.

Example:

```text
input:
  /workspace/in/source.pdf

output:
  /workspace/out/source.md
  /workspace/out/result.json
```

Avoid returning giant converted documents through MCP or an LLM client.

### 15.3 PDF routing

Initial logic:

```text
PDF
 ↓
normal MarkItDown extraction
 ↓
adequate textual extraction?
 ├─ yes -> return Markdown
 └─ no / page has inadequate text
        ↓
     OCR plugin for affected pages
        ↓
     merged Markdown
```

Use MarkItDown OCR behavior first; improve detection only if testing demonstrates problems.

### 15.4 OCR model access

The OCR worker talks to the model gateway via an OpenAI-compatible endpoint.

It does not know about OpenRouter directly.

### 15.5 Original artifacts

Original downloaded PDFs are temporary.

After successful conversion and transaction:

- delete original binary;
- retain exact source URL/provenance;
- retain converted Markdown in `raw/`.

### Acceptance gate

A normal text PDF and an image/scanned PDF both produce usable `raw/*.md` through the same `DocumentConverter` contract.

---

## 16. Phase 11 — Controlled acquisition

Wikiplane must control acquisition separately from conversion.

### Requirements

For remote URLs:

- HTTP/HTTPS only unless another scheme is explicitly supported;
- timeout;
- redirect limit;
- response size limit;
- content-type checks;
- SSRF protection;
- block local/private network targets by default;
- sanitize temporary filenames;
- no shell interpolation;
- retain exact supplied URL;
- optionally retain resolved URL;
- clean up temporary artifacts.

MarkItDown should normally receive a local temporary artifact rather than independently downloading the URL.

### Acceptance gate

Security tests cover localhost/private network attempts, redirect loops, oversized payloads, and unsupported schemes.

---

## 17. Phase 12 — Knowledge compiler

This is the main Wikiplane-specific semantic layer.

### 17.1 Start with the LLM Wiki ontology

Do not design a larger ontology before evidence exists.

Start with:

- source;
- concept;
- entity.

Keep LLM Wiki's schema/convention model.

Experiment before adding types such as:

- project;
- decision;
- experiment;
- event;
- claim.

### 17.2 Structured mutations

Do not ask the model to freely edit arbitrary files.

Prefer model outputs such as:

```text
CreateConcept
UpdateConcept
CreateEntity
UpdateEntity
AddSourceReference
RecordContradiction
AddCrossReferenceCandidate
```

Deterministic code applies the mutations.

### 17.3 Version prompts

Every semantic workflow must use versioned prompt assets in Wikiplane:

```text
config/prompts/integrate/v1.*
config/prompts/crosslink/v1.*
config/prompts/query/v1.*
```

Prompt changes should be reviewable Git changes.

### 17.4 Source context

The specialist integration model may read the converted source because that is its job.

The supervising Safeplane agent must not receive it.

### 17.5 Existing wiki context

Retrieve only relevant candidate pages.

Do not put the entire wiki into every model request.

### Acceptance gate

A source can create/update source/concept/entity pages through structured mutations and no arbitrary filesystem writes by the model.

---

## 18. Phase 13 — Contradiction preservation

Add explicit tests and prompts for disagreement.

### Required behavior

Given:

```text
source A -> claim X
source B -> incompatible claim Y
```

Wikiplane should not simply replace X with Y.

The wiki should preserve:

- X and source A;
- Y and source B;
- an explicit statement that they conflict or differ in scope when appropriate.

### Provenance

At minimum:

- concept/entity page has a sources section;
- exact source deep links are preserved;
- disputed/important sections link closely to supporting sources.

Do not require a citation marker after every sentence in v1.

### Acceptance gate

Golden contradiction cases pass deterministic provenance checks and LLM-judge checks.

---

## 19. Phase 14 — Cross-reference engine

### Workflow

```text
new/updated pages
    ↓
retrieve related candidates
    ↓
model judges relationship
    ↓
apply only useful forward links
    ↓
validate targets
    ↓
compute backlinks
```

### Rules

- links are ordinary relative Markdown links;
- target existence is validated before writing;
- reciprocal forward links are not automatic;
- backlinks are derived;
- optimize for precision.

### Acceptance gate

Golden related pages receive expected useful links; unrelated pages do not accumulate weak links.

---

## 20. Phase 15 — Deterministic rebuild and hygiene

Implement:

```bash
wikiplane rebuild
wikiplane rebuild --check
wikiplane lint
```

### `rebuild`

Must operate without an LLM.

At minimum:

1. scan `wiki/`;
2. validate frontmatter;
3. validate IDs;
4. validate source references;
5. validate Markdown links;
6. compute backlinks;
7. regenerate `wiki/index.md`;
8. regenerate any derived navigation added later;
9. detect orphan pages;
10. detect stale index entries.

### Invariant

Deleting generated indexes and rebuilding must restore the expected state.

### CI usage

```bash
wikiplane rebuild --check
```

must fail when committed derived state is stale.

### Acceptance gate

Delete the derived index files, rebuild, and reproduce the expected files exactly enough for deterministic CI.

---

## 21. Phase 16 — Re-ingest stability

Make convergence a first-class quality property.

### Golden scenarios

1. ingest source once;
2. ingest the exact same source again;
3. ingest the same source with trivial Markdown formatting variation;
4. ingest a slightly different OCR transcription preserving the same facts;
5. ingest the same source after a converter version change.

Expected:

- no duplicate source page;
- no duplicate concepts/entities;
- no unnecessary cross-link churn;
- no large unrelated rewrites;
- existing knowledge remains stable;
- only meaningful semantic differences should cause changes.

### Metrics

Track:

- number of pages created;
- number of pages modified;
- number of links added/removed;
- semantic diff judged meaningful/unnecessary;
- duplicate concept/entity count.

### Acceptance gate

Stability thresholds are established from the golden corpus.

---

## 22. Phase 17 — Web adapter experiment

Do not hard-code the web converter prematurely.

### Candidates

Benchmark:

1. `markfetch` — MIT;
2. Crawl4AI — Apache-2.0;
3. Safe Web Research extended with a focused extraction surface;
4. Jina Reader — Apache-2.0;
5. MarkItDown HTML as a baseline/fallback;
6. Firecrawl only as an optional remote/service adapter because of its AGPL licensing considerations.

Re-check current licenses at implementation time.

### Benchmark corpus

Include:

- clean article;
- documentation page;
- GitHub page;
- arXiv abstract;
- JS-heavy page;
- page with navigation noise;
- tables;
- code blocks;
- malformed HTML;
- paywall/blocked page;
- redirect;
- very long page.

### Evaluate

- main-content quality;
- Markdown structure;
- title/metadata;
- link retention;
- code/table handling;
- dynamic page support;
- safety;
- operational complexity;
- latency;
- licensing.

### Safe Web Research option

If extending Safe Web Research:

- keep it a separate project;
- add a generic safe acquisition/read capability there;
- Wikiplane uses it only through `WebConverter`/`SourceAcquirer`;
- do not introduce Wikiplane concepts into Safe Web Research.

### Acceptance gate

Select a default web adapter based on measured quality. Keep at least one fallback adapter if practical.

---

## 23. Phase 18 — Query

Query comes after ingestion, cross-referencing, and hygiene are reliable.

### Philosophy

Follow LLM Wiki:

> Query the precompiled wiki rather than repeatedly rereading raw sources.

Default query source:

```text
wiki/ (gold)
```

Only use `raw/` fallback when explicitly designed/needed.

### Pipeline

```text
question
  ↓
retrieve candidate wiki pages
  ↓
bounded context
  ↓
query model
  ↓
answer + relevant wiki/source references
```

### Retrieval v1

Do not require vector search initially.

Start with:

- wiki index;
- titles;
- summaries;
- tags/frontmatter;
- lexical/BM25-like search if needed.

Embeddings may later be added only as disposable derived state.

### Acceptance gate

Questions answer correctly from a multi-source fixture brain without loading the entire brain into model context.

---

## 24. Phase 19 — Source removal

Follow LLM Wiki's removal philosophy.

Implement:

```bash
wikiplane source remove <source-id>
```

### Workflow

```text
find raw source
   ↓
find knowledge pages that cite it
   ↓
remove source attribution
   ↓
re-evaluate affected knowledge
   ↓
delete unsupported knowledge where appropriate
   ↓
preserve claims supported elsewhere
   ↓
reconsider contradictions
   ↓
repair links
   ↓
rebuild
   ↓
lint
   ↓
atomic commit
```

Do not make removal a simple `rm raw/foo.md`.

### Acceptance gate

Removing one of two supporting sources leaves shared knowledge intact; removing the only supporting source cleans up unsupported content.

---

## 25. Phase 20 — Operation log and observability

Keep `wiki/log.md` initially.

### `wiki/log.md`

Record human-readable operations such as:

- source ingested;
- source refreshed;
- source removed;
- concepts/entities created/updated;
- validation result.

Do not dump prompts or whole documents into the log.

### Structured runtime telemetry

For every operation assign an operation ID.

Capture:

- source reference;
- adapter selected;
- stages and durations;
- model roles/models;
- token/cost metadata when available;
- pages created/updated;
- links added/removed;
- lint result;
- Git commit;
- error stage/reason.

### Result returned to callers

Example:

```json
{
  "status": "success",
  "operation_id": "op_...",
  "source_id": "src_...",
  "title": "Adaptive Memory for Agents",
  "created": {
    "concepts": 2,
    "entities": 1
  },
  "updated_pages": 4,
  "cross_links_added": 8,
  "validation": {
    "broken_links": 0,
    "missing_sources": 0
  },
  "commit": "abc123"
}
```

The result must remain compact.

---

## 26. Phase 21 — CLI

Build CLI surfaces over the same application service used by MCP.

Suggested commands:

```bash
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

Add options for config/brain selection as needed.

The CLI must not contain domain logic.

---

## 27. Phase 22 — MCP server

Expose high-level operations, not every internal file mutation.

Initial tools:

```text
wikiplane_status
wikiplane_ingest
wikiplane_query
wikiplane_lint
wikiplane_rebuild
wikiplane_remove_source
wikiplane_recompile
```

MCP responses should return structured summaries/handles, not whole source documents by default.

Keep low-level internal tools private unless a real interoperability use case requires them.

### Acceptance gate

An MCP client can ingest a source and query the resulting wiki without receiving the raw converted source in its conversational context.

---

## 28. Phase 23 — Docker-first runtime

### Initial Docker Compose

Target:

```text
services:
  wikiplane:
    Node/TypeScript application

  model-gateway:
    copied Safeplane model gateway

  markitdown:
    MarkItDown + OCR worker
```

The selected web adapter may later add another service.

### Volumes

Use dedicated mounts for:

- temporary acquisition artifacts;
- operation worktrees;
- brain checkout;
- converter input/output.

Do not broadly mount the brain repo into services that do not need it.

### Network policy

Where practical:

- only Wikiplane acquisition/web adapter requires arbitrary outbound web access;
- model gateway requires model-provider outbound access;
- converter should not need arbitrary external web access if it receives local artifacts;
- internal service ports should not be exposed publicly by default.

### Acceptance gate

`docker compose up` produces a working local stack with health checks.

---

## 29. Phase 24 — Testing strategy

Testing should be stronger than snapshot testing generated Markdown.

### 29.1 Unit tests

Cover:

- copied/adapted core;
- frontmatter parsing;
- source lookup;
- provenance;
- link manipulation;
- index generation;
- Git transaction logic;
- config validation;
- adapter selection.

### 29.2 Adapter contract tests

Every adapter must pass its generic contract.

### 29.3 Deterministic integration tests

Use local fixtures and a local/bare Git remote.

Test:

- initial brain creation;
- Markdown ingest;
- rebuild;
- stale index detection;
- broken links;
- rollback on failure;
- atomic commits;
- source removal.

### 29.4 Docker integration tests

Test:

- Wikiplane -> model gateway;
- Wikiplane -> MarkItDown;
- MarkItDown OCR -> model gateway;
- full compose health.

### 29.5 Golden semantic tests

Each fixture defines expected semantic properties.

Example:

```yaml
name: llmwiki-paper

expected:
  facts:
    - "knowledge is stored in Markdown"
    - "the core can operate independently of VS Code"

  concepts:
    required:
      - markdown-knowledge-base

  entities:
    required:
      - microsoft

  contradictions:
    required: []

  must_not:
    - "unsupported claim ..."
```

Avoid exact prose snapshots unless testing deterministic formatting.

### 29.6 LLM judge tests

Judge:

- important facts captured;
- unsupported claims;
- concept duplication;
- entity resolution;
- contradiction preservation;
- cross-link usefulness;
- unnecessary rewriting;
- answer quality.

Use a judge model separate from the tested model where practical.

### 29.7 Stability tests

Explicitly test repeated ingestion and transcription drift.

### 29.8 OCR corpus

Include:

- normal text PDF;
- scanned typed PDF;
- low-resolution scan;
- rotated page;
- two-column academic paper;
- table;
- formula-heavy page;
- diagram labels;
- German/English mixture;
- poor contrast.

### 29.9 Web corpus

Use the web benchmark described earlier.

---

## 30. Phase 25 — CI/CD

### Pull request CI

Run:

- formatting/lint;
- TypeScript build;
- unit tests;
- copied core regression tests;
- deterministic integration tests;
- adapter contract tests;
- Docker build;
- security/static checks;
- license/notice checks;
- fixture brain rebuild checks.

Do not require expensive live model tests on every PR.

### Model eval workflow

Separate manually triggered or scheduled workflow:

- starts Docker stack;
- uses configured gateway;
- runs golden semantic corpus;
- produces model comparison report;
- records cost/latency/quality.

### Release readiness

Before making Wikiplane public:

- all documentation complete;
- no secrets/history leakage;
- no personal brain data;
- example brain is synthetic/public;
- licenses verified;
- dependency licenses reviewed;
- security boundaries documented;
- golden eval results published in repo documentation.

---

## 31. Phase 26 — Create the real private brain repository

Do this after the capability can initialize and maintain a brain correctly.

### Steps

1. Create private GitHub repository, e.g. `<owner>/<brain-name>`.
2. Configure Wikiplane with its remote.
3. Run `wikiplane brain init`.
4. Inspect generated README/AGENTS/raw/wiki structure.
5. Push initial commit.
6. Verify GitHub browsing.
7. Add no personal content manually yet.
8. Run first controlled ingest.
9. Verify resulting commit/diff manually.
10. Add a few representative real sources only after the golden fixtures pass.

### Acceptance gate

Fresh clone of the data repository is readable and self-describing without the Wikiplane code repository.

---

## 32. Phase 27 — End-to-end vertical slice

This is the first major project milestone.

### Required scenario

Input:

```text
PDF deep link
```

Example class:

```text
https://arxiv.org/pdf/<paper-id>
```

### Expected execution

```text
exact URL
  ↓
safe acquire
  ↓
temporary PDF
  ↓
MarkItDown
  ↓
OCR only where needed
  ↓
raw/<source>.md
  ↓
source page
  ↓
concept/entity integration
  ↓
contradiction handling
  ↓
cross-link
  ↓
index rebuild
  ↓
lint
  ↓
wiki/log.md
  ↓
atomic Git commit
  ↓
push
  ↓
query resulting wiki
```

### Assertions

- original PDF is not committed;
- exact supplied deep link is present;
- raw converted Markdown is committed;
- wiki pages reference the source;
- relevant concepts/entities exist;
- links are ordinary Markdown;
- index is valid;
- log contains the operation;
- no broken links;
- query can retrieve the newly integrated knowledge;
- supervising caller only receives a compact result.

---

## 33. Phase 28 — Full golden corpus

Build a persistent evaluation corpus before large-scale personal use.

Recommended cases:

1. Markdown source with one novel concept.
2. PDF source with same concept.
3. Same source ingested twice.
4. Same source with formatting/transcription differences.
5. Same entity under slightly different wording.
6. Two independent sources supporting the same fact.
7. Two sources contradicting one another.
8. Source correcting an older source.
9. Completely unrelated source.
10. Dense source with many candidate concepts.
11. Scanned PDF.
12. Bad OCR.
13. Web article.
14. JS-heavy webpage.
15. Long webpage with navigation noise.
16. Source removal.
17. Source refresh.
18. Full wiki recompile.
19. Index deletion + deterministic rebuild.
20. Query spanning multiple sources.

Track results by model and adapter version.

---

## 34. Phase 29 — Recompile support

After normal ingest is stable, add:

```bash
wikiplane recompile --all
```

### Safety model

Never destroy the current gold wiki first.

Instead:

```text
current brain
   │
   ├───────────────┐
   │               │
   ▼               ▼
current wiki   temporary rebuilt wiki
                   │
                   ▼
                  diff
```

Only replace current state through an explicit validated transaction.

### Purpose

Use recompile for:

- new model evaluation;
- prompt upgrades;
- schema migrations;
- cross-link algorithm changes;
- ontology experiments.

### Expectation

Semantic recovery, not byte-identical generated prose.

---

## 35. Phase 30 — Safeplane integration

Only start after Wikiplane has passed its own end-to-end and golden tests.

### Safeplane owns the workflow

Example workflow:

```text
second-brain-ingest
```

Inputs:

```text
source reference
optional brain name
optional intent/tags
```

Safeplane calls one high-level Wikiplane operation.

It does not:

- download the PDF itself;
- read the converted Markdown;
- perform concept extraction;
- call cross-linking tools directly;
- rebuild indexes itself;
- commit the brain repo itself.

### Preferred integration

Use Wikiplane MCP or another stable high-level API.

Conceptual call:

```text
wikiplane_ingest({
  source: "https://arxiv.org/pdf/..."
})
```

Return:

```text
success
source title
source ID
pages created/updated
links added
validation summary
commit SHA
```

### Token goal

The supervising agent should spend only the tokens required to:

- understand the user command;
- invoke the workflow;
- understand/report the result.

The source body remains outside its context.

---

## 36. Phase 31 — Public release preparation

Wikiplane should remain private until value has been demonstrated.

Before public release:

1. inspect Git history for secrets/private brain content;
2. confirm all imported LLM Wiki licensing/attribution;
3. verify copied Safeplane model-gateway licensing;
4. re-check MarkItDown and OCR plugin licenses;
5. re-check selected web adapter license;
6. ensure Firecrawl AGPL code has not been copied into Wikiplane;
7. provide synthetic example brain;
8. publish architecture;
9. publish brain repository format;
10. publish adapter-development guide;
11. publish eval methodology/results;
12. document threat model;
13. document recovery/rebuild guarantees;
14. provide Docker quickstart;
15. ensure a new user can run the project without Safeplane.

---

## 37. Suggested milestone sequence

### M0 — Repository bootstrap

- private `wikiplane` repo;
- TypeScript workspace;
- MIT;
- CI;
- architecture docs.

**Exit:** clean green skeleton.

### M1 — LLM Wiki core import

- copy core;
- preserve license;
- run upstream tests;
- remove VS Code assumptions.

**Exit:** standalone copied core works.

### M2 — Brain format + Git transactions

- initialize storage-only brain;
- raw/wiki/AGENTS/log/index;
- worktree transactions;
- commit/push.

**Exit:** deterministic data repository management.

### M3 — Adapter architecture + Markdown ingest

- define ports;
- fake adapters;
- Markdown adapter;
- first full ingest without PDF/web.

**Exit:** concept/entity/wiki flow proven.

### M4 — Model gateway

- copy Safeplane gateway;
- adapter;
- structured output;
- multimodal test.

**Exit:** Wikiplane and OCR worker can call models through one gateway.

### M5 — MarkItDown + OCR

- container;
- PDF conversion;
- OCR fallback;
- raw persistence;
- artifact cleanup.

**Exit:** PDF deep link -> raw Markdown.

### M6 — Semantic compiler

- versioned prompts;
- structured mutations;
- integration;
- contradiction handling.

**Exit:** PDF -> useful wiki knowledge.

### M7 — Cross-reference + deterministic rebuild

- semantic forward links;
- backlinks;
- index rebuild;
- lint/hygiene.

**Exit:** validated gold state.

### M8 — Stability and golden evals

- repeated ingest;
- transcription drift;
- contradiction corpus;
- model comparison.

**Exit:** quantified acceptable behavior.

### M9 — Web adapter experiment

- benchmark candidates;
- select default;
- implement adapter.

**Exit:** robust webpage -> raw Markdown path.

### M10 — Query

- retrieval;
- model answer;
- source/page references.

**Exit:** useful second-brain query.

### M11 — Removal + recompile

- LLM Wiki-style removal;
- safe full recompile.

**Exit:** maintenance lifecycle complete.

### M12 — CLI + MCP hardening

- stable public commands/tools;
- structured results;
- Docker docs.

**Exit:** Wikiplane is a reusable capability.

### M13 — Real private brain

- create actual brain repo;
- controlled real-world ingestion;
- verify GitHub browsing.

**Exit:** practical second brain works.

### M14 — Safeplane workflow

- high-level ingestion/query workflows;
- compact control-plane interaction.

**Exit:** "send a link to the agent" workflow works without source-token waste.

### M15 — Public-release review

- licenses;
- security;
- docs;
- evals;
- synthetic example;
- repo readiness.

**Exit:** candidate for public release.

---

## 38. Definition of done

Wikiplane is functionally complete for the intended second-brain use case when all of the following are true.

### Repository separation

- Wikiplane system repository contains all implementation.
- Brain repository contains storage only.
- Safeplane is a consumer, not part of Wikiplane internals.

### Source ingestion

- exact deep links are retained;
- Markdown, PDF, scanned PDF, and webpage sources are supported through adapters;
- original remote binaries/HTML are not committed;
- converted Markdown is persisted in `raw/`;
- no content hash is required for identity/change semantics.

### Knowledge integration

- LLM Wiki source/concept/entity model works;
- repeated ingestion is stable;
- overlapping sources merge cleanly;
- contradictions remain explicit;
- meaningful cross-links are generated;
- provenance is visible.

### Hygiene

- indexes are deterministically rebuildable;
- broken links are detected;
- stale index entries are detected;
- orphan behavior is defined;
- removal follows LLM Wiki semantics;
- operation log is retained.

### Query

- questions are answered primarily from the compiled wiki;
- full raw corpus is not reread for ordinary queries;
- relevant pages/sources can be traced.

### Git

- every successful ingest creates an atomic validated commit;
- failed operations do not corrupt gold state;
- brain can be browsed directly on GitHub;
- Git history provides auditability.

### Tooling

- every external tool is behind an adapter;
- MarkItDown is replaceable;
- OCR model is replaceable;
- web extractor is replaceable;
- model gateway is replaceable;
- provider-specific logic does not leak into core.

### Model efficiency

- OCR uses the smallest adequate vision model based on evaluation;
- integration/crosslink/query models are selected empirically;
- Safeplane's supervising agent never needs the source content merely to orchestrate ingestion.

### Testing

- deterministic test suite is green;
- copied LLM Wiki regression tests are green;
- Docker integration tests are green;
- golden semantic corpus meets thresholds;
- repeated-ingest stability is measured;
- contradiction cases pass;
- fresh clone/rebuild works.

---

## 39. First implementation ticket sequence

A practical first sequence for execution:

- [x] 1. Create private `wikiplane` repo.
- [x] 2. Add TypeScript workspace, MIT, CI, architecture docs.
- [x] 3. Clone Microsoft LLM Wiki at a pinned SHA.
- [x] 4. Copy `packages/core` into Wikiplane.
- [x] 5. Add LLM Wiki license and import provenance.
- [ ] 6. Make copied core tests green.
- [x] 7. Remove/abstract VS Code-specific assumptions from copied core.
- [x] 8. Define Wikiplane adapter ports.
- [x] 9. Define Wikiplane config schema.
- [x] 10. Implement local Git repository provider.
- [x] 11. Implement worktree transaction engine.
- [x] 12. Implement `brain init`.
- [x] 13. Create synthetic fixture brain.
- [x] 14. Implement Markdown adapter.
- [x] 15. Build first Markdown -> wiki -> lint -> commit integration test.
- [x] 16. Copy Safeplane model-gateway container.
- [x] 17. Verify OpenAI-compatible text calls.
- [x] 18. Verify structured-output calls.
- [x] 19. Verify multimodal pass-through.
- [x] 20. Add TypeScript `ModelProvider` adapter.
- [x] 21. Add versioned integration prompt v1.
- [x] 22. Convert freeform model output to structured mutations.
- [x] 23. Add contradiction golden test.
- [x] 24. Create MarkItDown worker container.
- [x] 25. Add MarkItDown OCR plugin.
- [x] 26. Wire OCR to model gateway.
- [x] 27. Implement controlled URL/PDF acquisition.
- [x] 28. Implement `DocumentConverter` adapter.
- [x] 29. Add normal PDF golden fixture.
- [x] 30. Add scanned PDF golden fixture.
- [x] 31. Implement PDF URL end-to-end ingest.
- [x] 32. Implement cross-reference pass.
- [x] 33. Implement deterministic rebuild.
- [x] 34. Implement `rebuild --check`.
- [x] 35. Extend lint/hygiene tests.
- [x] 36. Add repeated-ingest stability corpus.
- [ ] 37. Compare model classes.
- [ ] 38. Run web-adapter benchmark.
- [ ] 39. Implement selected default web adapter.
- [ ] 40. Add webpage end-to-end golden tests.
- [x] 41. Implement query.
- [x] 42. Implement source removal.
- [x] 43. Implement safe full recompile.
- [x] 44. Implement stable CLI.
- [x] 45. Implement high-level MCP server.
- [ ] 46. Run full Docker E2E.
- [x] 47. Create real private brain repository.
- [ ] 48. Run controlled real-source ingestion.
- [x] 49. Harden documentation/security/observability.
- [ ] 50. Integrate Wikiplane into Safeplane with high-level workflows.
- [ ] 51. Prove the end-user "send a link" workflow.
- [ ] 52. Perform public-release readiness review.

Notes: ticket 6 remains unchecked until the copied Node regression suite is executed with installed workspace dependencies. Tickets 17–19 are unit-verified against the OpenAI-compatible gateway boundary; provider-live behavior belongs to ticket 37/model evaluation. Ticket 31 denotes the implemented URL→acquire→convert→ingest code path, while Phase 27 remains open until a live PDF fixture passes. Ticket 47 records the prepared `wikiplane-data` repository layout; its private GitHub state cannot be verified from a ZIP snapshot.
---

## 40. Explicit non-goals for v1

Do not delay the project for:

- large custom ontology;
- vector database;
- perfect source-equivalence detection across different URLs;
- byte-identical LLM recompilation;
- custom web UI;
- original-document archival;
- public multi-tenant hosting;
- autonomous schema mutation;
- automatic Model Gateway extraction to its own repo;
- every possible document format;
- claim-level citation after every sentence.

Prove the Git-native Markdown knowledge lifecycle first.

---

## 41. Key experiments to document

The project should keep an explicit experiment log for architectural questions that are intentionally evidence-driven.

### Experiment A — Re-ingest stability

Question:

> Does ingesting the same or slightly different transcription create unnecessary wiki churn?

### Experiment B — Model class

Question:

> What is the smallest model that reliably integrates sources, resolves concepts/entities, preserves contradictions, and cross-links well?

### Experiment C — OCR model

Question:

> Can a very small vision model achieve acceptable OCR on the real corpus, and when is a fallback required?

### Experiment D — Web converter

Question:

> Which adapter produces the best safe, readable Markdown across realistic webpages?

### Experiment E — LLM Wiki core changes

Question:

> Which copied upstream assumptions actually need to change for Wikiplane, and which should be preserved?

### Experiment F — Ontology

Question:

> Are source/concept/entity sufficient in real use, or do recurring cases justify explicit project/decision/experiment/event types?

Only evolve architecture after these experiments produce evidence.

---

## 42. Final target experience

Once complete:

```text
User
  |
  | "Add this to my brain:
  |  https://arxiv.org/pdf/2609.24972"
  v
Safeplane workflow
  |
  | wikiplane_ingest(source)
  v
Wikiplane
  |
  +-- safe acquisition
  +-- adapter selection
  +-- MarkItDown / OCR
  +-- raw Markdown persistence
  +-- knowledge integration
  +-- contradiction preservation
  +-- semantic cross-references
  +-- deterministic indexes
  +-- lint/validation
  +-- operation log
  +-- Git commit/push
  |
  v
Private GitHub brain
  |
  +-- raw/
  +-- wiki/
  +-- concepts/
  +-- entities/
  +-- sources/
  +-- index.md
  +-- log.md

Safeplane receives:
  "Ingested successfully.
   2 concepts created.
   3 pages updated.
   7 links added.
   Validation clean.
   Commit abc123."
```

The source document itself never needs to pass through the supervising agent's context.

That is the core value proposition of Wikiplane.
