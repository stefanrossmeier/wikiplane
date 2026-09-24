# Backlog

This file records intentionally deferred product work that is not part of the current supported architecture. Items move into ADRs and implementation plans only after the project makes a concrete decision.

## Document transcription for image-only/scanned sources

**Status:** deferred

Wikiplane currently supports document conversion when the selected converter can extract usable text. Image-only/scanned document support is intentionally excluded from the current release.

Future work should evaluate OCR and non-OCR transcription approaches behind a replaceable adapter boundary. The decision must include:

- conversion quality on representative scans and academic documents;
- dependency and container licensing;
- model/provider independence;
- cost and latency;
- security and data-boundary implications;
- re-ingest stability when transcriptions change between versions.

No implementation or runtime dependency should be added until that evaluation is complete.

## Other evidence-driven work

- Benchmark and select the default web conversion adapter.
- Establish live model assignments from quality/cost/latency evaluation.
- Expand the semantic golden corpus and publish stability thresholds.
- Add full Docker end-to-end release validation with representative public sources.
