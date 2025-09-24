
# syntax=docker/dockerfile:1

# --- base: Node + pnpm ---
FROM node:20-slim AS base
WORKDIR /app
# If you keep a lockfile, COPY it too for better caching:
# COPY pnpm-lock.yaml ./
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

# --- builder: compile a specific workspace (and its deps) ---
# Pass APP_FILTER at build time, e.g. @wmx/server or @wmx/refresher
FROM base AS builder
ARG APP_FILTER=@wmx/server
# bring all sources
COPY . .
# Install deps for the target workspace and its dependency graph
# (no frozen lockfile to keep local iteration easy; switch to --frozen-lockfile in CI)
RUN pnpm -r --filter ${APP_FILTER}... install --no-frozen-lockfile
# Build the target workspace
RUN pnpm -r --filter ${APP_FILTER}... build

# --- app: thin runtime with the built code ---
FROM node:20-slim AS app
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini curl \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

# copy the whole repo from builder (includes node_modules + dist for target workspace)
COPY --from=builder /app /app

ENTRYPOINT ["/usr/bin/tini","--"]
# The actual command is provided by docker-compose per-service.

