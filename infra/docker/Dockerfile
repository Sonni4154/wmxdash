# syntax=docker/dockerfile:1

## Base image with Node and pnpm enabled. The build stage will install
## dependencies for all packages in the workspace. We rely on pnpm as
## the package manager to keep node_modules efficient across services.
FROM node:20-slim AS base
WORKDIR /app
# Copy root manifests required to bootstrap the workspace. The
# pnpm-lock.yaml file must exist at the repository root to ensure
# reproducible builds. If you haven't yet generated a lockfile run
# `pnpm install` locally.
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

# --- build all workspaces ---
FROM base AS builder
# Copy the entire repository into the image. This stage contains
# everything needed to compile all apps and packages.
COPY . .
# Install and build all packages. We disable frozen lockfile so that
# developers can iterate without committing lockfile changes during local
# development. In CI you should enable `--frozen-lockfile`.
#RUN pnpm -r install --no-frozen-lockfile
#RUN pnpm -r build
# only build the server (and its deps)
RUN pnpm -r --filter @wmx/server... install --no-frozen-lockfile
RUN pnpm -r --filter @wmx/server... build
# --- final runtime ---
FROM base AS app
COPY --from=builder /app /app
ENV NODE_ENV=production
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
# The actual command is specified in docker-compose.yml. See that file
# for the entrypoint and arguments for each service.
