# LangExtract Monorepo (Foundations / M0)

This repo scaffolds the foundations described in `AGENTS.md`.

- Monorepo structure using pnpm workspaces
- Services: API (Express), Worker (BullMQ), Web (Next.js)
- Packages: core (types & logger), clients (TS + Python)
- Infrastructure: docker-compose for Postgres, Redis, MinIO, Ollama, and app services

## Quick Start (Dev without Docker)

- Copy `.env.example` to `.env` and adjust if needed
- Install deps: `pnpm i`
- Run services:
  - API: `pnpm --filter @api dev` (http://localhost:3001/health)
  - Worker: `pnpm --filter @worker dev` (http://localhost:3002/health)
    - Defaults to in-memory queue when `REDIS_URL` is not set
  - Web: `pnpm --filter @web dev` (http://localhost:3000)

### One-liners (helpers)

- Start all: `pnpm dev:all`
- Stop all: `pnpm stop:all`
- Restart all: `pnpm restart:all`
- Status: `pnpm status:all`

The helpers read ports from `.env` if present. Under the hood they call `bash scripts/dev.sh` and manage PIDs in `.dev/`.

## Docker Compose (Full stack)

- Ensure Docker is running and network access is available
- Copy `.env.example` to `.env`
- Run: `pnpm compose:up` (or `bash scripts/compose.sh up`)
- Health endpoints:
  - API: `http://localhost:3001/health`
  - Worker: `http://localhost:3002/health`
  - Web: `http://localhost:3000/api/health`
  - Redis: `redis://localhost:6379`
  - Postgres: `postgres://postgres:postgres@localhost:5432/langextract`
  - MinIO: `http://localhost:9001` (console)
  - Ollama: `http://localhost:11434`

## Notes

- Endpoints listed in AGENTS.md are stubbed in API for now.
- Worker exposes a small HTTP server for health and `/enqueue` testing.
- Core logger provides contextual logs with `request_id` and `job_id` fields when you pass them in `makeLogger().with({ request_id, job_id })`.
- Image ingest (dev/prod): OCR runs via `tesseract.js`.
  - `OCR_LANG` defaults to `eng`; you can provide multiple (e.g., `eng fra`).
  - To run fully offline, download `*.traineddata` and set `OCR_LANG_PATH` to that directory (e.g., `./.dev/tessdata`).
  - The dev helper normalizes `OCR_LANG_PATH` to an absolute path if the directory exists; otherwise it unsets it so CDN fallback works.
  - Health: `GET http://localhost:3001/ocr/health` shows module status and local traineddata detection.
- This is a starting point; LangExtract, OCR, validators, and schema tooling will be added in subsequent milestones.
