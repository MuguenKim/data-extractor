# syntax=docker/dockerfile:1

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /app

# Monorepo deps
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate

# Build target selection
ARG APP_DIR
WORKDIR /app/${APP_DIR}

RUN pnpm i --frozen-lockfile || pnpm i
RUN pnpm build || true

EXPOSE 3000 3001 3002

CMD ["sh", "-lc", "pnpm start"]

