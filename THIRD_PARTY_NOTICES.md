# Third-Party Notices

## Microsoft LLM Wiki

Wikiplane contains an adapted copy of Microsoft LLM Wiki core code and its regression fixtures/tests. The imported revision and copied paths are recorded in `third_party/llmwiki/UPSTREAM.md`. The upstream MIT license is retained at `third_party/llmwiki/LICENSE`.

## Safeplane model gateway

Wikiplane began with a copy of `services/model-gateway` from Safeplane commit `9688b7d1a3cc7f1d82d1829ea81d421ef0bbb211` and adapts it in-place. Safeplane is Apache-2.0 licensed; the retained license is at `third_party/safeplane/LICENSE`. See `third_party/safeplane/UPSTREAM.md` for import details.

## Runtime dependencies

MarkItDown is consumed as a Python dependency by the isolated converter service rather than copied into this repository. Dependency/license checks belong in release CI and must be re-run against pinned versions before public release.
