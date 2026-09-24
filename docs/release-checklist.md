# Release checklist

Use this checklist before changing repository visibility or cutting a public release.

## Deterministic validation

- [ ] `scripts/bootstrap` succeeds from a clean clone.
- [ ] `tests/scripts/test-quality` is green.
- [ ] `tests/scripts/test-unit` is green.
- [ ] `tests/scripts/test-docker` is green with a running Docker daemon.
- [ ] `wikiplane rebuild --check` is clean on the synthetic example brain.

## Repository hygiene

- [ ] `git status --short` is clean after validation.
- [ ] No `.env`, secrets, private keys, local worktrees, generated package metadata, or private brain data are tracked.
- [ ] Git history has been scanned for credentials and private data, not only the current tree.
- [ ] Example/evaluation data is synthetic or clearly redistributable.

## Licensing and provenance

- [ ] `THIRD_PARTY_NOTICES.md` matches the current runtime and copied code.
- [ ] Microsoft LLM Wiki provenance and retained license are present.
- [ ] Safeplane provenance records commit `9688b7d1a3cc7f1d82d1829ea81d421ef0bbb211` and the retained Apache-2.0 license.
- [ ] Runtime dependency licenses have been reviewed at the versions being released.

## Documentation

- [ ] README quickstart works from a clean clone.
- [ ] `SECURITY.md` contains current private-reporting instructions.
- [ ] Architecture and ADR links resolve.
- [ ] Deferred functionality is described only in `docs/BACKLOG.md`, not as implemented behavior.
- [ ] Current limitations are stated explicitly.

## Release evidence

- [ ] The deterministic test counts are recorded in the release notes.
- [ ] Live model evaluation results are available for any concrete model recommendations.
- [ ] Web-adapter claims match measured evidence.
- [ ] Any stable-release claims are backed by representative end-to-end runs.
