# Testing strategy

Tests are split into deterministic TypeScript regression/integration tests, Python service tests, Docker integration, and live semantic evaluation.

The copied Microsoft LLM Wiki suites remain under `tests/shared` with their upstream fixtures. Wikiplane tests cover root-level brain initialization, configuration, safe acquisition, Markdown end-to-end ingest, unchanged re-ingest convergence, contradiction/removal semantics, and real Git worktree isolation.

Python service tests run without provider credentials in fake mode. Expensive live model/OCR/web quality tests are deliberately separate from pull-request CI and must record model/adapter versions, latency, cost, and semantic metrics instead of relying on exact generated prose snapshots.
