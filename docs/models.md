# Model gateway and model policy

Wikiplane addresses logical roles (`integrate`, `crosslink`, `query`, `ocr`, optional `judge`) rather than provider model IDs. The application calls only the OpenAI-compatible model gateway. The MarkItDown OCR worker uses that same gateway and does not know about OpenRouter.

No production model assignment is encoded as an architectural decision. `config/models/models.example.yaml` intentionally contains no concrete aliases. Fake mode needs none. Real mode is configured through `MODEL_ALIAS_WIKIPLANE_INTEGRATE`, `..._CROSSLINK`, `..._QUERY`, `..._OCR`, and optionally `..._JUDGE`, or through a private aliases YAML.

Run the live evaluation workflow before fixing model assignments. Measure structured-output correctness, semantic coverage, duplication, contradiction handling, cross-link precision, latency, token usage/cost, and re-ingest stability. OCR evaluation should separately cover text PDFs, scans, rotation, academic columns, tables, formulas, labels, mixed German/English, and poor contrast.
