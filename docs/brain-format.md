# Brain repository format

A Wikiplane brain is a directly browsable Git repository:

```text
README.md
AGENTS.md
raw/
wiki/
  index.md
  log.md
  sources/
  concepts/
  entities/
```

`raw/*.md` contains the current durable transcription plus source provenance. `wiki/sources/*.md` is the stable source registry. Concept/entity pages aggregate source-scoped claim blocks and explicit contradiction blocks. `wiki/index.md` is derived and reproducible; `wiki/log.md` is a compact human-readable operation history.

Remote identity is the exact supplied URL. Different URLs are distinct v1 sources. Content hashes are deliberately not identity. Re-ingesting an unchanged representation produces no semantic write; a changed transcription updates the existing stable source record.

The instantiated root `AGENTS.md` is the active schema/convention contract. Runtime configuration never belongs in a brain.
