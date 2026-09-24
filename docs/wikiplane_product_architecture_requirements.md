# Wikiplane — Product & Architecture Requirements

**Document type:** Product & Architecture Requirements (PAR)  
**Status:** Draft implementation companion  
**Project:** Wikiplane

> This document complements `wikiplane_complete_implementation_plan.md`. The implementation plan describes **what to build and in what order**. This document captures **product boundaries, architecture invariants, adapter philosophy, source semantics, model policy, trust boundaries, and the rationale behind the design**.

## 1. Product definition

Wikiplane is a **Git-native Markdown wiki capability** that turns external source material into a structured, cross-referenced, queryable knowledge base.

It is not the brain repository itself. It is the system that acquires a source, converts it to Markdown, integrates it into an existing wiki, cross-references it, rebuilds indexes, validates the result, and commits the successful state to Git.

The Markdown wiki is a core feature, not an incidental storage format.

### Core value proposition

A user or supervising agent should be able to provide:

```text
https://arxiv.org/pdf/2609.24972
```

and receive a compact result such as:

```text
Ingested successfully.
2 concepts created.
4 pages updated.
7 cross-links added.
Validation clean.
Commit abc123.
```

The PDF and converted Markdown do **not** need to pass through the supervising agent's conversational context.


---

## 2. Product boundaries

Wikiplane intentionally separates three concerns.

### 2.1 Wikiplane system repository

Contains implementation:

- copied/adapted LLM Wiki core;
- source acquisition;
- adapters;
- model access;
- semantic compiler;
- cross-referencing;
- index generation;
- linting;
- query;
- Git transactions;
- CLI/MCP;
- Docker services;
- tests and evals;
- runtime configuration.

### 2.2 Brain/wiki data repository

A separate private Git repository used as storage only.

It contains:

```text
brain/
├── README.md
├── AGENTS.md
├── raw/
└── wiki/
    ├── index.md
    ├── log.md
    ├── sources/
    ├── concepts/
    └── entities/
```

It does **not** contain Wikiplane code, Safeplane workflows, adapter code, Docker Compose, model gateway code, package dependencies, or secrets.

### 2.3 Safeplane

Safeplane is a downstream consumer.

Safeplane owns:

- deciding when Wikiplane should run;
- choosing the configured brain;
- workflow-level authorization or approval;
- reporting the compact result.

Safeplane does not implement Wikiplane's ingestion internals.


---

## 3. Control plane and data plane

This is a first-class architecture rule.

### Control plane

Contains compact instructions and results:

```text
ingest this URL
query this brain
remove this source
rebuild
```

and:

```json
{
  "status": "success",
  "pages_updated": 4,
  "links_added": 7,
  "commit": "abc123"
}
```

Safeplane and supervising agents operate primarily here.

### Data plane

Contains:

- downloaded PDFs/HTML;
- converted Markdown;
- rendered OCR page images;
- relevant wiki pages;
- specialist model context;
- proposed mutations;
- generated index data.

These artifacts move directly between Wikiplane-owned services and tools.

### Requirement

Do not return whole document bodies through MCP/tool responses merely to move them between services. Prefer file paths, artifact handles, source IDs, and operation IDs.


---

## 4. Relationship to Microsoft LLM Wiki

Wikiplane starts from Microsoft LLM Wiki's core architecture:

```text
raw/      source-of-truth material
wiki/     generated/interlinked knowledge
AGENTS.md schema/conventions
```

Reference:

- https://github.com/microsoft/llmwiki
- https://github.com/microsoft/llmwiki/blob/main/ARCHITECTURE.md

Wikiplane retains the useful concepts:

- Markdown as durable state;
- entities and concepts;
- source pages;
- standard Markdown links;
- `wiki/index.md`;
- `wiki/log.md`;
- linting;
- Git-friendly storage;
- a core independent from VS Code.

### Reuse decision

Wikiplane will:

- copy the useful core code;
- import it at a pinned upstream commit;
- retain the MIT license and notices;
- copy relevant core tests;
- adapt the code in-place;
- not depend on `@llmwiki/core` at runtime;
- not carry the VS Code extension.

### Wikiplane additions

Wikiplane adds:

- safe remote acquisition;
- document/web adapters;
- PDF conversion and OCR;
- Docker-first runtime;
- model gateway integration;
- Git transaction ownership;
- semantic re-ingest stability testing;
- explicit control/data plane separation;
- autonomous source-to-commit workflows.


---

## 5. Storage lifecycle and medallion model

The medallion architecture is a mental model, not three physical copies.

### Bronze

`raw/` is bronze.

It stores the durable Markdown transcription of sources.

Original remote PDF/HTML binaries are not committed.

### Silver

Silver is ephemeral:

- temporary artifact directories;
- isolated Git worktree;
- model outputs;
- proposed wiki mutations.

There is no permanent `silver/` directory.

### Gold

The committed, validated `wiki/` state is gold.

It has passed:

- semantic integration;
- cross-reference generation;
- deterministic index rebuild;
- linting;
- validation;
- Git transaction checks.


---

## 6. Raw source and provenance semantics

`raw/` contains source transcriptions, not original binaries.

### Why raw Markdown is retained

It provides:

- inspectability;
- portability;
- recompile ability;
- independence from source availability;
- Git history;
- compatibility with the LLM Wiki model.

### Original artifacts

For remote sources:

1. download to temporary storage;
2. convert;
3. persist Markdown;
4. discard original artifact after successful processing;
5. retain provenance.

### Exact deep-link provenance

If the user supplies:

```text
https://arxiv.org/pdf/2609.24972
```

that exact reference must be retained.

Do not replace it with the domain root.

A resolved/redirected URL may also be retained for diagnostics, but it does not replace the user-supplied reference.


---

## 7. Source identity and re-ingest behavior

Wikiplane does **not** use content hashes as source identity or change semantics.

### Rationale

Transcription is not guaranteed to be byte-stable:

- converter upgrades may change Markdown formatting;
- OCR may produce small changes;
- extraction may improve;
- normalization may change.

Hashes would measure representation bytes rather than source identity or semantic novelty.

### Initial remote-source identity

The exact supplied source reference is the v1 lookup key for recognizing a previously ingested remote source.

The same deep link means re-ingest/refresh.

Different URLs are initially treated as different source references, even if they happen to contain the same document.

Cross-URL source equivalence is a future experiment.

### Semantic convergence requirement

Re-ingesting the same source, or a slightly different transcription of it, should produce essentially the same wiki state with minimal churn.

Expected:

- no duplicate source page;
- no duplicate concepts/entities;
- no broad unrelated rewrites;
- no unnecessary link churn.

This must be a golden-test category.

### History

If a re-ingest updates the current raw transcription, Git history provides the previous representation.


---

## 8. Contradictions are knowledge

Contradictory sources are not ingestion failures.

If source A supports claim X and source B supports incompatible claim Y, Wikiplane should:

- preserve X;
- preserve Y;
- retain provenance for both;
- make the disagreement explicit when material;
- avoid silently choosing one;
- avoid falsely reconciling incompatible claims.

Queries may therefore answer:

```text
Source A reports X, while Source B reports Y.
```

Removal or refresh of a contradictory source must trigger re-evaluation of affected knowledge.


---

## 9. Schema and ontology

Follow the LLM Wiki schema philosophy.

### Initial ontology

Start with:

- source;
- concept;
- entity.

Do not invent a large ontology before real usage demonstrates the need.

Potential later page types may include project, decision, experiment, event, claim, person, or organization.

### `AGENTS.md`

Wikiplane owns the authoritative schema template.

The active brain repository contains an instantiated `AGENTS.md` so the stored wiki remains self-describing.

It may define:

- page types;
- directory structure;
- frontmatter;
- naming conventions;
- ingestion rules;
- lint rules;
- cross-reference rules.

Schema mutation is not autonomous in v1.


---

## 10. Configuration ownership

Wikiplane owns runtime configuration.

The brain repository does not.

Wikiplane config may contain:

- target brain remote/branch;
- adapter selection;
- model gateway endpoint;
- logical model roles;
- Git author;
- acquisition limits;
- prompt versions;
- logging policy.

Secrets come from environment variables, Docker secrets, or CI secret stores.

The brain repository contains no runtime credentials.


---

## 11. Adapter architecture

All replaceable external capabilities sit behind Wikiplane-owned interfaces.

Initial adapter categories:

```text
SourceAcquirer
DocumentConverter
WebConverter
OcrProvider
ModelProvider
RepositoryProvider
```

Potential later adapters include audio, video, email, Slack, GitHub, and cloud documents.

### Hard dependency rule

Core may know:

```text
DocumentConverter
```

but not:

```text
MarkItDown
```

Core may know:

```text
ModelProvider
```

but not:

```text
OpenRouter
```

Core may know:

```text
WebConverter
```

but not:

```text
Firecrawl
```

Replacing a concrete implementation must not require changes to semantic compiler logic.


---

## 12. Adapter data contracts

Adapters should exchange structured metadata plus artifact handles/paths.

Prefer:

```text
acquire(url) -> artifact handle
convert(artifact) -> converted source path + diagnostics
```

over:

```text
convert(url) -> 100 KB Markdown string passed through an agent
```

Diagnostics may include:

- adapter name/version;
- duration;
- warnings;
- media type;
- OCR pages;
- fallback used.

Diagnostics do not define source identity.


---

## 13. Acquisition adapter

Acquisition and conversion are separate responsibilities.

Wikiplane should normally:

1. validate the source reference;
2. acquire it safely;
3. save a temporary artifact;
4. pass the local artifact to the converter.

### Security baseline

Remote acquisition must consider:

- HTTP/HTTPS allowlist;
- SSRF;
- localhost/private-network blocking;
- redirect limits;
- response-size limits;
- timeouts;
- content-type checks;
- safe temporary paths;
- unsupported protocols.

The supplied URL is provenance. The resolved URL is acquisition metadata.


---

## 14. Document conversion and MarkItDown

The initial document converter is Microsoft MarkItDown, behind a Wikiplane adapter.

References:

- https://github.com/microsoft/markitdown
- https://github.com/microsoft/markitdown/tree/main/packages/markitdown-ocr

The current MarkItDown OCR package declares an MIT license and supports an OpenAI-compatible vision client.

### Deployment

Run MarkItDown in an isolated Python container/worker.

Wikiplane TypeScript communicates through `DocumentConverter`.

### OCR routing

Conceptually:

```text
document
  ↓
normal extraction
  ↓
text adequate?
  ├─ yes → finish
  └─ no → OCR affected pages
```

Avoid sending every page through vision unnecessarily.


---

## 15. OCR model policy

OCR is a separate logical model role:

```text
ocr
```

Start with a small/cheap vision model.

Evaluate:

- transcription accuracy;
- reading order;
- tables;
- mixed German/English;
- low-resolution scans;
- rotated pages;
- academic layouts;
- diagram labels.

If needed:

```text
ocr.primary  = small model
ocr.fallback = stronger model
```

The converter must not hard-code a provider-specific model.


---

## 16. Web adapter strategy

The web converter is intentionally evidence-driven.

### Safe Web Research

Project:

https://github.com/stefanrossmeier/safe-web-research

Safe Web Research remains independent.

If extended, the new capability should be generic safe acquisition/extraction functionality useful beyond Wikiplane.

Wikiplane consumes it only through an adapter.

### Other candidates

Benchmark at least:

- markfetch;
- Crawl4AI;
- Jina Reader;
- MarkItDown HTML;
- Firecrawl as a separately deployed/service option.

Current upstream materials describe:

- Crawl4AI as Apache-2.0;
- Jina Reader as Apache-2.0;
- Firecrawl core as primarily AGPL-3.0, with some SDK/UI pieces under MIT.

Licenses must be re-verified at the pinned implementation versions.

### Firecrawl policy

Do not copy Firecrawl core into an MIT Wikiplane codebase without a deliberate licensing decision.

A separately operated Firecrawl service may still be usable behind `WebConverter`.

### Benchmark dimensions

Evaluate:

- main-content quality;
- Markdown structure;
- headings;
- links;
- code blocks;
- tables;
- JS-heavy pages;
- boilerplate removal;
- safety;
- latency;
- Docker complexity;
- licensing;
- resource usage.


---

## 17. Model gateway architecture

Initially copy the existing Safeplane model-gateway service into Wikiplane.

Source location:

```text
safeplane/services/model-gateway
```

Do not extract it into a standalone project before Wikiplane proves the shared interface.

### Wikiplane dependency

Core depends only on:

```text
ModelProvider
```

The first implementation points to the copied gateway.

### Gateway validation requirements

Verify:

- OpenAI-compatible API;
- OpenRouter upstream;
- text requests;
- structured output;
- multimodal/image passthrough;
- retries/timeouts;
- model aliases;
- usage/cost metadata;
- safe logging;
- no Safeplane-specific request assumptions.

Later, when Safeplane and Wikiplane have both validated the common needs, extract the gateway into its own project.


---

## 18. Model roles

Wikiplane config maps logical roles to actual models.

Initial roles:

```text
integrate
crosslink
query
ocr
```

Optional evaluation role:

```text
judge
```

### `integrate`

Needs strong structured reasoning for:

- create vs update;
- semantic merging;
- contradiction handling;
- source attribution;
- durable concept/entity extraction.

### `crosslink`

Judges whether a relationship is useful.

Optimize for precision.

### `query`

Synthesizes from selected gold wiki pages.

### `ocr`

Transcribes images/pages and should normally use the smallest adequate vision model.

Concrete model choices are evaluation outcomes, not architecture decisions.


---

## 19. Prompt ownership

Wikiplane owns all prompts used by Wikiplane.

Prompts must be:

- versioned;
- stored in the Wikiplane repo;
- reviewable;
- regression-tested against golden cases.

Prompt changes are compiler changes because they may alter persistent knowledge.


---

## 20. Semantic compiler authority

The specialist compiler may read converted source text and selected related wiki pages.

That is its job.

The design restriction is that these contents should not be routed through the supervising agent merely to coordinate the workflow.

### Bounded context

Do not send the entire brain on every ingest.

Retrieve candidate pages first.

### Structured mutations

Prefer model outputs such as:

```text
CreateSourcePage
UpdateSourcePage
CreateConcept
UpdateConcept
CreateEntity
UpdateEntity
AddSourceReference
RecordContradiction
AddCrossReference
```

Application code applies and validates filesystem mutations.

The LLM is an expert compiler component, not an unrestricted repository agent.


---

## 21. Cross-reference policy

Cross-reference generation is part of Wikiplane ingestion.

### Forward links

Write only when useful to a reader.

### Backlinks

Compute from the Markdown graph.

### Reciprocity

Do not automatically create reciprocal authored links.

### Quality target

Prefer high precision over high recall.

A slightly underlinked wiki is better than a noisy link graph.


---

## 22. Index and rebuild policy

`wiki/index.md` is derived navigation.

It must not contain unique information that cannot be reconstructed from wiki pages.

### Rebuild requirements

Index rebuilding must be:

- deterministic;
- LLM-free;
- suitable for CI;
- able to detect stale generated state.

If summaries/tags/categories are needed by the index, they should exist authoritatively in reconstructible page metadata.


---

## 23. Query philosophy

Follow the LLM Wiki philosophy:

> Query the precompiled wiki instead of rereading all raw sources for every question.

Normal path:

```text
question
  ↓
retrieve gold wiki pages
  ↓
bounded context
  ↓
answer
```

`raw/` is not the normal query corpus.

A future explicit raw fallback may exist, but it should be observable and deliberate.


---

## 24. Retrieval policy

Do not add a vector database merely because the product contains knowledge.

Start with:

- index;
- titles;
- summaries;
- frontmatter;
- tags;
- lexical/BM25-style retrieval;
- links.

If embeddings/vector search are later added, they are disposable derived state and never authoritative.


---

## 25. Git ownership and transactions

Wikiplane owns Git operations on the brain repository:

- clone;
- fetch;
- worktree;
- stage;
- commit;
- push;
- rollback.

An ingest is one transaction.

```text
fetch base
  ↓
isolated worktree
  ↓
convert
  ↓
integrate
  ↓
cross-reference
  ↓
rebuild
  ↓
lint
  ↓
validate
  ↓
commit/push
```

On failure, no gold commit is produced.

Start with one atomic commit per ingest.


---

## 26. Operation log and observability

Keep `wiki/log.md` initially.

It complements Git with a simple Markdown operation history.

Runtime observability should capture:

- operation ID;
- source reference;
- selected adapters;
- stage timings;
- model roles/models;
- token/cost metadata where available;
- OCR fallback;
- pages created/changed;
- links added/removed;
- lint results;
- commit SHA;
- failure stage.

Do not log whole document or prompt bodies by default.


---

## 27. Removal semantics

Follow LLM Wiki's removal philosophy.

Removing a source must:

1. identify dependent knowledge;
2. remove source attribution;
3. re-evaluate affected pages;
4. preserve knowledge supported elsewhere;
5. remove unsupported knowledge where appropriate;
6. reconsider contradictions;
7. repair links;
8. rebuild indexes;
9. lint;
10. commit transactionally.

It is not just `rm raw/file.md`.


---

## 28. Failure model

Autonomous behavior needs explicit failures.

Suggested stages:

```text
ACQUIRE_FAILED
CONVERT_FAILED
OCR_FAILED
MODEL_FAILED
INTEGRATION_FAILED
CROSSLINK_FAILED
REBUILD_FAILED
LINT_FAILED
GIT_FAILED
PUSH_FAILED
```

The caller receives a compact stage-specific result.

No partial gold state is committed.


---

## 29. Product stability requirements

Quality includes convergence, not just successful completion.

### Re-ingest stability

Same source twice should produce little or no semantic change.

### Transcription stability

Small OCR/converter differences should not destabilize the wiki.

### Existing-knowledge stability

A new source should not rewrite unrelated pages.

### Cross-link stability

Nondeterministic weak link churn is a defect.

These should be explicitly measured in golden tests.


---

## 30. Golden-sample testing

Golden tests assert semantic properties rather than exact generated prose.

Example:

```yaml
expected:
  facts:
    - fact A
    - fact B

  concepts:
    required:
      - concept-a

  entities:
    required:
      - entity-a

  contradictions:
    required:
      - claim-x-vs-y

  must_not:
    - unsupported claim z
```

### Deterministic checks

Use deterministic assertions for:

- provenance;
- files/frontmatter;
- links;
- indexes;
- duplicate IDs;
- Git cleanliness;
- transaction rollback.

### LLM judges

Use judges for:

- fact coverage;
- unsupported claims;
- semantic duplication;
- contradiction preservation;
- cross-link usefulness;
- unnecessary rewriting;
- query quality.


---

## 31. Docker-first runtime

Initial services:

```text
wikiplane
model-gateway
markitdown
```

A selected web adapter may add another service.

Docker isolates:

- TypeScript app;
- Python converter;
- OCR dependencies;
- Python model gateway;
- browser-based web extraction;
- credentials.

Only services that need a brain mount, internet access, or model credentials should receive them.


---

## 32. Security and trust boundaries

Treat acquired content as untrusted.

```text
internet
  ↓
SourceAcquirer
  ↓
temporary artifact
  ↓
converter
  ↓
raw Markdown
  ↓
semantic model
  ↓
structured proposed mutations
  ↓
deterministic validation
  ↓
Git commit
```

Consequences:

- untrusted documents do not get arbitrary execution;
- model output does not get unrestricted filesystem authority;
- path handling is validated;
- commit occurs only after validation.


---

## 33. Human browsing requirement

The brain repository is a supported user interface.

A person should be able to navigate:

```text
README
  ↓
wiki/index.md
  ↓
concept/entity/source pages
  ↓
cross-links
  ↓
raw transcription and exact source link
```

A custom frontend is not a v1 requirement.

GitHub Markdown rendering is sufficient initially.


---

## 34. Safeplane integration contract

When Safeplane integration begins, Safeplane should need only high-level operations such as:

```text
wikiplane_ingest
wikiplane_query
wikiplane_remove_source
wikiplane_status
```

Safeplane should not orchestrate:

```text
download_pdf
run_ocr
create_concept
update_entity
add_link
rebuild_index
```

Those are Wikiplane internals.


---

## 35. MCP and CLI product surfaces

### MCP

Expose high-level tools.

Responses should be compact structured summaries, not full documents.

### CLI

CLI remains required for:

- testing;
- debugging;
- CI;
- recovery;
- automation;
- usage without an agent host.

CLI and MCP should call the same application services.


---

## 36. Licensing policy

Wikiplane is intended to remain straightforward to publish under MIT.

Guidelines:

- retain licenses/notices for copied MIT code;
- review Apache-2.0 requirements for adopted dependencies/services;
- do not copy strong-copyleft code into the MIT codebase without a deliberate decision;
- external services may remain separate behind adapters, but distribution implications still require review.

Architecture-relevant upstream facts to re-check at pinned versions:

- Microsoft LLM Wiki: MIT;
- MarkItDown OCR: MIT;
- Crawl4AI: currently described upstream as Apache-2.0;
- Jina Reader: currently described upstream as Apache-2.0;
- Firecrawl core: currently described upstream as primarily AGPL-3.0.

Licensing is evaluated per pinned version, not assumed forever.


---

## 37. Private-first product handling

Both Wikiplane and the first real brain start private.

This allows:

- schema evolution;
- real diff inspection;
- prompt tuning;
- model comparison;
- adapter comparison;
- security hardening;
- licensing review;
- golden-eval development.

Public release occurs only after value is demonstrated.


---

## 38. Non-goals for v1

Do not block the core product for:

- a custom web UI;
- a vector database;
- perfect cross-URL source equivalence;
- byte-identical LLM output;
- a large predefined ontology;
- original remote binary archival;
- sentence-level citation everywhere;
- enterprise multi-tenancy;
- autonomous schema mutation;
- every media format;
- immediate extraction of the model gateway into a third repository.


---

## 39. Evidence-driven open experiments

These are intentionally unresolved.

### Web converter

Compare Safe Web Research, markfetch, Crawl4AI, Jina Reader, MarkItDown HTML, and Firecrawl-as-service.

### Integration model

Find the smallest model that preserves semantic quality and stability.

### Cross-link model

Determine whether a cheaper model can maintain high precision.

### OCR model

Determine how small the vision model can be before transcription quality becomes unacceptable.

### Ontology

Observe whether source/concept/entity become insufficient in real use.

### Re-ingest stability

Establish acceptable semantic-diff thresholds for repeated ingestion.


---

## 40. Explicit architecture decisions

| Area | Decision |
|---|---|
| Project | Wikiplane |
| Language | TypeScript |
| Runtime | Docker-first |
| Brain storage | Separate private Git repository |
| Durable format | Markdown |
| Layout | `raw/` + `wiki/` + `AGENTS.md` |
| Medallion mapping | raw=bronze, transaction=silver, committed wiki=gold |
| Original remote binaries | temporary only |
| Provenance | exact supplied deep link |
| Content hashes | not used for identity/change semantics |
| Re-ingest goal | semantic convergence/minimal churn |
| Contradictions | explicitly preserved |
| Initial ontology | source/concept/entity |
| LLM Wiki | copied core, MIT notice retained |
| VS Code extension | excluded |
| External tools | adapters only |
| PDF conversion | MarkItDown adapter |
| OCR | MarkItDown OCR via model-provider endpoint |
| Web conversion | benchmark before default selection |
| Model gateway | copy Safeplane service initially |
| Upstream model provider | OpenRouter through gateway initially |
| Cross-linking | precision-oriented |
| Indexes | deterministic/rebuildable |
| Query | gold wiki first |
| Removal | LLM Wiki semantics |
| Operation log | retained initially |
| Git operations | owned by Wikiplane |
| Ingest commit | atomic; one commit initially |
| Safeplane | downstream control-plane consumer |
| Release | private until value/evals proven |


---

## 41. Product success test

The core product is proven when this works reliably:

```text
User sends:
https://arxiv.org/pdf/<paper>
```

Without the supervising agent reading the document:

```text
Wikiplane
  acquires
  converts
  uses OCR only where necessary
  stores raw Markdown
  integrates concepts/entities
  preserves contradictions
  adds meaningful links
  rebuilds index
  lints
  commits/pushes
```

Then the user can:

1. browse the private GitHub wiki;
2. follow cross-references;
3. follow provenance to the exact source;
4. query the compiled wiki successfully.

Repeating the same ingest should cause little or no unnecessary semantic change.

That complete lifecycle—not merely PDF-to-Markdown conversion—is Wikiplane's product value.


---

## 42. Reference projects

Re-verify licenses and APIs at pinned versions before adoption.

- Microsoft LLM Wiki  
  https://github.com/microsoft/llmwiki

- LLM Wiki architecture  
  https://github.com/microsoft/llmwiki/blob/main/ARCHITECTURE.md

- Microsoft MarkItDown  
  https://github.com/microsoft/markitdown

- MarkItDown OCR  
  https://github.com/microsoft/markitdown/tree/main/packages/markitdown-ocr

- Safe Web Research  
  https://github.com/stefanrossmeier/safe-web-research

- Crawl4AI  
  https://github.com/unclecode/crawl4ai

- Jina Reader  
  https://github.com/jina-ai/reader

- Firecrawl  
  https://github.com/firecrawl/firecrawl


---

## 43. Relationship to the implementation plan

Use this document when deciding:

- whether responsibility belongs to Wikiplane or Safeplane;
- whether a tool may be called directly from core;
- what belongs in the brain repository;
- whether a state is authoritative or derived;
- what content may cross the supervising-agent boundary;
- how source identity should behave;
- how contradictions are handled;
- whether a dependency must be replaceable;
- whether an unresolved choice is a requirement or an experiment.

Use `wikiplane_complete_implementation_plan.md` for:

- milestone order;
- repository/file creation;
- test gates;
- exact implementation phases;
- brain-repo creation timing;
- Safeplane integration timing.

Together, the two documents form the initial Wikiplane implementation specification.
