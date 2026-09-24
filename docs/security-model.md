# Security model

This document describes Wikiplane's technical trust boundaries. For reporting a vulnerability, use [SECURITY.md](../SECURITY.md).

## Untrusted inputs

Wikiplane treats the following as untrusted:

- remote URLs and remote response data;
- downloaded PDFs/HTML/documents;
- converted Markdown;
- OCR output;
- model responses;
- source-provided links and metadata.

Runtime configuration and the selected brain repository are administrative trust inputs in v1; Wikiplane is not yet a multi-tenant authorization boundary.

## Data flow

```text
internet / local source
        │
        ▼
SourceAcquirer
        │
        ▼
temporary artifact
        │
        ▼
DocumentConverter / WebConverter
        │
        ▼
raw Markdown
        │
        ▼
semantic model
        │
        ▼
structured proposed mutations
        │
        ▼
deterministic validation/application
        │
        ▼
rebuild + lint
        │
        ▼
Git transaction / commit
```

## Remote acquisition

The acquisition layer is responsible for:

- allowing only explicitly supported URL schemes;
- rejecting credential-bearing URLs;
- resolving and blocking localhost/private/link-local/multicast destinations;
- re-validating redirects;
- enforcing redirect limits;
- enforcing timeouts and streaming byte limits;
- checking media types;
- creating safe temporary filenames;
- cleaning temporary artifacts.

Converters normally receive local artifact paths instead of independently fetching arbitrary URLs.

## Filesystem and converter boundary

Converter inputs/outputs are confined to configured workspace roots. MarkItDown runs as a separate service and receives artifact paths rather than unrestricted repository access.

Original remote binaries are temporary. Durable source state is the converted Markdown transcription plus provenance.

## Model boundary

The model gateway provides an OpenAI-compatible boundary and maps logical roles to concrete provider models. Application/core code does not depend directly on an upstream provider.

The semantic compiler asks models for structured mutations. Model output is parsed and validated; it does not receive unrestricted filesystem, shell, or Git authority.

## Git boundary

Knowledge-changing operations execute in an isolated worktree/transaction. Rebuild and lint run before the resulting state becomes gold. Failed operations do not intentionally leave partial gold commits.

Git commands are invoked with argument arrays rather than interpolated shell commands.

## Secrets and observability

Secrets belong in environment variables, Docker secrets, or CI secret stores. They must not be committed to a brain repository or configuration file intended for source control.

Runtime telemetry intentionally omits document/prompt bodies by default. Diagnostics are filtered before being recorded.

## Remaining risk areas

Important areas for continued testing include:

- DNS rebinding and redirect edge cases;
- parser/converter vulnerabilities in third-party document libraries;
- prompt injection influencing semantic quality despite structured output constraints;
- malicious Git remotes or local repository state;
- model/provider logging outside Wikiplane's control;
- future authentication/authorization surfaces if Wikiplane becomes multi-user.
