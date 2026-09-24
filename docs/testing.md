# Testing strategy

Tests are split into deterministic TypeScript regression/integration tests, Python service tests, Docker integration, and live semantic evaluation.

The copied Microsoft LLM Wiki suites remain under `tests/shared` with their upstream fixtures. Wikiplane tests cover root-level brain initialization, configuration, safe acquisition, Markdown end-to-end ingest, unchanged re-ingest convergence, contradiction/removal semantics, and real Git worktree isolation.

Python service tests run without provider credentials in fake mode. Expensive live model and web-conversion quality tests are deliberately separate from pull-request CI and must record model/adapter versions, latency, cost, and semantic metrics instead of relying on exact generated prose snapshots.

## Local test environment

A clean checkout must not depend on globally installed pnpm or Python service packages. Bootstrap with:

```bash
scripts/bootstrap
```

This performs two independent steps:

- `scripts/bootstrap-node` installs workspace dependencies with the `packageManager` version pinned in `package.json`, invoked as `corepack pnpm` without creating global Corepack symlinks.
- `scripts/bootstrap-python` creates `.venv` and installs both Python services with their `[test]` extras. Set `WIKIPLANE_PYTHON=/path/to/python` to choose a Python interpreter explicitly.

Run deterministic tests with:

```bash
tests/scripts/test-unit
```

Run the Docker build separately:

```bash
tests/scripts/test-docker
```

Docker tests require a running Docker daemon. A stopped Docker Desktop/daemon is an environment prerequisite failure, not a Wikiplane test failure.

## Canonical Node test command

`tests/scripts/test-node` runs:

```bash
corepack pnpm run test:node
```

This builds all workspace packages, runs TypeScript typechecking, and executes Vitest. The aggregate `corepack pnpm run ci` command additionally runs the quality gate.

## Test versus quality entrypoints

`tests/scripts/test-unit` runs implementation validation only: Node build, TypeScript typecheck, Vitest, and the Python service tests. It intentionally does not run formatting or lint checks. This keeps test failures distinct from repository-style failures.

Use `tests/scripts/test-quality` for repository quality checks:

```bash
tests/scripts/test-quality
```

That command runs Prettier in check mode, ESLint, and the repository policy check. `tests/scripts/test-all` runs quality checks, unit tests, and the Docker build in that order.

The root package scripts follow the same split:

```bash
corepack pnpm run test:node
corepack pnpm run quality
corepack pnpm run ci
```

`pnpm run ci` remains the aggregate Node CI gate; `tests/scripts/test-unit` does not call it because formatting/lint failures are not unit-test failures.
