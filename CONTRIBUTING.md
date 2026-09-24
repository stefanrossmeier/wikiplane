# Contributing

Use Node 22 and pnpm. Keep domain logic in `packages/application` or the adapted core; CLI and MCP are thin surfaces. External systems belong behind ports in `packages/application/src/ports.ts`.

Before submitting a change run:

```bash
corepack enable
pnpm install
pnpm ci
PYTHONPATH=services/model-gateway/src pytest -q services/model-gateway/tests
PYTHONPATH=services/markitdown/src pytest -q services/markitdown/tests
```

Prompt changes under `config/prompts/` are compiler changes and require semantic regression cases. Do not commit real brain content, provider keys, downloaded source binaries, operation worktrees, or telemetry.
