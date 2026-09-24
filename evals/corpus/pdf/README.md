# PDF golden fixtures

Synthetic, non-personal fixtures for document conversion and OCR evaluation.

- `native-text.pdf` contains an ordinary PDF text layer. A correct baseline conversion should recover the visible sentences without vision OCR.
- `scanned-image-only.pdf` contains a rasterized page and no PDF text layer. A correct OCR-enabled conversion should recover the visible sentences, including the mixed German/English line.

Expected visible facts are intentionally simple and stable:

1. Native fixture: durable knowledge is stored as Markdown and versioned in Git.
2. Native fixture: the exact source reference is retained as provenance.
3. Scanned fixture: OCR should recover the sentence faithfully.
4. Scanned fixture: `Deutsch und English: Wissen bleibt in Markdown.`

The fixtures establish reproducible inputs. They do **not** establish that a particular vision model meets the quality threshold; that remains a live model-evaluation result.
