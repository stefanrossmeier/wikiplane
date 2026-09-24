# Ingestion and maintenance

`wikiplane ingest <source>` performs a complete transaction: acquire, convert, register/update raw source, compile structured knowledge, cross-link, rebuild, lint, commit, and optionally push.

The semantic compiler retrieves bounded candidate pages from the deterministic index. The model returns concepts/entities, source-supported claims, and contradictions. Deterministic code stores those as source-scoped blocks. This enables stable refresh and deterministic source removal without asking a model to rewrite arbitrary files.

`wikiplane source refresh <source-id>` refreshes the existing source record by stable source ID. Remote sources reacquire the exact stored supplied reference; local sources reacquire the stored resolved path while preserving the originally supplied reference as provenance. `wikiplane source remove <source-id>` removes that source's blocks, drops unsupported pages, preserves knowledge backed by other sources, invalidates contradictions that reference the removed source, repairs links, rebuilds, and commits atomically.

`wikiplane rebuild` is deterministic and LLM-free. `wikiplane rebuild --check` and `wikiplane lint` fail on stale derived state, broken links, schema/provenance errors, duplicate IDs, and missing referenced sources. `wikiplane recompile --all` rebuilds semantic concept/entity state from durable raw Markdown in an isolated transaction without first destroying committed gold state.
