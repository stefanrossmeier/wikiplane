# Wikiplane evaluations

Deterministic tests run in normal CI. Expensive or evidence-driven choices live here and are intentionally separate.

- `model-role-eval.mjs` compares candidate integration/cross-link models through the gateway and records structured-output validity, simple semantic checks, latency, and provider usage/cost metadata.
- Web conversion evaluation should compare safe acquisition + MarkItDown HTML baseline against candidate `WebConverter` implementations on clean articles, docs, GitHub, arXiv abstracts, JS-heavy pages, navigation noise, tables/code, malformed/blocked pages, redirects, and very long pages.
- Re-ingest stability belongs in both deterministic fixtures and live semantic evaluation: pages created/modified, links added/removed, duplicate count, and judged unnecessary churn.

Reports are generated artifacts and are ignored except when intentionally curated for publication.
