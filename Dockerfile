FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts ./
COPY packages ./packages
RUN pnpm install --no-frozen-lockfile
RUN pnpm -r build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/* && corepack enable && git config --system --add safe.directory /brain-remote
COPY --from=build /app /app
COPY config ./config
ENV WIKIPLANE_CONFIG=/app/config/docker.yaml
EXPOSE 8020
CMD ["node", "packages/cli/dist/health.js"]
