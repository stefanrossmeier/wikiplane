# Third-Party Notices

## Microsoft LLM Wiki

Wikiplane contains an adapted copy of Microsoft LLM Wiki core code and its regression fixtures/tests. The imported revision and copied paths are recorded in `third_party/llmwiki/UPSTREAM.md`. The upstream MIT license is retained at `third_party/llmwiki/LICENSE`.

## Safeplane model gateway

Wikiplane began with a copy of `services/model-gateway` from Safeplane and adapts it in-place. Safeplane is Apache-2.0 licensed; the retained license is at `third_party/safeplane/LICENSE`. See `third_party/safeplane/UPSTREAM.md` for provenance status.

## Runtime dependencies

MarkItDown and MarkItDown OCR are consumed as Python dependencies by the isolated converter service rather than copied into this repository. Dependency/license checks belong in release CI and must be re-run against pinned versions before public release.
