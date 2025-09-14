# Milestones (final)

## Progress Tracker

- Last Updated: 2025-09-14

- Milestones:
  - [ ] M0. Repo & Infra (Day 1–2)
- [ ] M1. Ingest + Baseline Extraction + Functional UI (Week 1)
  - [ ] M2. LangExtract + Groq/Ollama Core (Week 2)
  - [ ] M3. Validation + Review UI (Week 3)
  - [ ] M4. Schema Inference + Editor (Week 4)
  - [ ] M5. Public API + SDK + Deployable PoC (Week 5)

- Acceptance Tests (details below):
  - [ ] AT-01
  - [ ] AT-02
  - [ ] AT-03
  - [ ] AT-04
  - [ ] AT-05
  - [ ] AT-06


**M0. Repo & Infra (Day 1–2)**
**M1. Ingest + Baseline Extraction + Functional UI (Week 1)**
**M2. LangExtract + Groq/Ollama Core (Week 2)**
**M3. Validation + Review UI (Week 3)**
**M4. Schema Inference + Editor (Week 4)**
**M5. Public API + SDK + Deployable PoC (Week 5)**

## M0 — Repo & Infra

* Mono-repo scaffolding; minimal dev mode (in-memory) + optional Compose (Postgres/Redis/MinIO/Ollama)
* Health routes; shared DTO lib; fixtures (5 docs)

**DoD:** `pnpm dev` launches API/Web/Worker locally; `docker compose up` works.

Status (updated on 2025-09-14)

- [x] Monorepo scaffolding present (`apps/*`, `packages/*`, `infrastructure/*`)
- [x] Minimal dev mode via in-memory stores (API jobs/workflows)
- [x] Health routes: API (`/health`), Worker (`/health`)
- [x] Shared DTO/types in `packages/core/src/types.ts`
- [x] Fixtures available in `fixtures/`
- [x] `pnpm dev:all` launches API/Web/Worker (currently `pnpm dev:all` via `scripts/dev.sh`)
- [x] `docker compose up` web healthcheck passes (missing `apps/web/pages/api/health.ts`)

## M1 — Ingest + Baseline Extraction + Functional UI

**Backend**

* File adapters (PDF/Image, DOCX, CSV/XLSX, HTML/URL) → `TextArtifact`
* Baseline extractor implemented (regex/labels/tables) + spans + confidence
* Endpoints: projects, files, ingest job, baseline extract (per project)

**Frontend**

* `/projects` (create); `/projects/[id]` (summary)
* `/projects/[id]/ingest` (multi-upload, progress, file table)
* `/projects/[id]/extract` (Run Baseline Extraction for **all files**; status; uses Active Workflow when set)
* `/projects/[id]/results/[fileId]` (document viewer with **highlighted spans**)

**Tests**

Golden Tests (M1) — implement in CI with fixture-driven assertions. Use ResultEnvelope-like JSON for expected fields where applicable; store expected under `fixtures/golden/baseline/`.

Golden files to add (authoritative expected outputs for baseline extractor):
- `fixtures/golden/baseline/invoice.txt.json`
- `fixtures/golden/baseline/invoice.html.json`
- `fixtures/golden/baseline/invoice.csv.json`
- `fixtures/golden/baseline/invoice1.png.json`
- `fixtures/golden/baseline/invoice2.png.json`
- `fixtures/golden/baseline/invoice3.pdf.json`
- `fixtures/golden/baseline/invoice4.pdf.json`

Metrics & thresholds (M1):
- Ingest success rate: ≥95% across all uploaded fixtures in a run.
- Extraction coverage: 100% of `processed` files yield at least one core field with spans.
- Table coverage: at least one file produces ≥1 line item with spans on `qty` or `unit_price`.

**DoD:** Upload → see **real extracted fields** (not stubs) with spans, for all project files.

Status (investigated on 2025-09-14)

- Backend
  - [x] File adapters implemented (`packages/core/src/ingest/*`)
  - [x] Baseline extractor with spans/confidence (`packages/core/src/extractors/baseline.ts`)
  - [x] API endpoints for projects/files/ingest job/baseline extract (in-memory dev)
- Frontend
  - [X] Required routes `/projects`, `/projects/[id]`, `/ingest`, `/results/[fileId]`
  - [X] Results viewer with highlighted spans
- Tests
  - [X] Golden tests and ingest success metrics implemented (see `tests/*` and `fixtures/golden/baseline/*`)
- DoD
  - [X] End-to-end upload → spans in results for all project files (dev-min JSON ingest)

## M2 — LangExtract + Groq/Ollama Core

**Backend**

* LangExtract wrapper + chunker + merge; model router (Ollama fast → Groq precision)
* Workflow create/bind; `/extract?workflow_id=` (schema-controlled)

**Frontend**

* `/projects/[id]/format`: select existing schema; **Run Extraction** (schema mode)
* `/projects/[id]/results/[fileId]`: value/confidence/spans JSON download

**Tests**

* Contract tests: ≥90% critical fields have spans on fixtures

**DoD:** Schema-controlled extraction returns strict JSON + spans across project files.

Status (investigated on 2025-09-14)

- Backend
  - [x] LangExtract wrapper + chunker + merge (`packages/core/src/langextract/*`)
  - [x] Model router with backends: mock/groq/ollama (network backends stubbed)
  - [x] Workflows create/bind (`POST /projects/:id/workflows`); list/activate (`GET /projects/:id/workflows`, `PATCH /projects/:id/workflows/:workflowId/activate`); global list (`GET /workflows`)
  - [x] Extraction endpoint (`POST /projects/:id/extract?workflow_id=...`) defaults to Active Workflow when param omitted
  - [x] Groq/Ollama calls 
- Frontend
  - [x] `/projects/[id]/format` implemented; `/projects/[id]` shows Selected Format when set; `/workflows` lists workflows across projects
  - [x] Job page allows JSON download of result
- Tests
  - [x] Contract tests for spans coverage
- DoD
  - [x] Project-wide schema-controlled extraction with spans

## M3 — Validation + Review UI

**Backend**

* JSON-Schema validation + Rule DSL; file & project-level status (`ok|needs_review|failed`)

**Frontend**

* `/projects/[id]/results/[fileId]`: rule outcomes; inline edits; “Re-validate” button
* Project results page: filter by status, export CSV/JSON

**DoD:** Failed rules → “Needs Review”; edits persist; re-validate passes.

Status (investigated on 2025-09-14)

- Backend
  - [x] Rule DSL implemented (`packages/core/src/validation/dsl.ts`)
  - [ ] JSON-Schema validation layer
  - [ ] Grounding re-read check
- Frontend
  - [ ] Review UI, inline edits, re-validate controls
- DoD
  - [ ] Not met

## M4 — Schema Inference + Editor

**Backend**

* `/infer_schema` (project): propose draft JSON Schema; versioning

**Frontend**

* `/projects/[id]/format`: **Infer Format** → **Schema Editor** (JSON form) → Save → Re-run Extraction

**DoD:** Start with no schema → infer → user adjusts → saved & reused.

Status (investigated on 2025-09-14)

- [ ] `/infer_schema` backend endpoint
- [ ] Schema Editor UI under `/projects/[id]/format`
- [ ] Versioning and storage of inferred schema

## M5 — Public API + SDK + Deployable PoC

**Backend**

* Harden routes; webhooks; RBAC (org/project/API key); rate limits

**Frontend**

* `/settings`: backend, OCR, language
* Demo toggle: “Run PoC demo” seeds a sample project & one-click run

**SDKs/Deploy**

* TS + Python clients; Fly/Render config; CI

**DoD:** External SDK runs project → ingest → infer/choose schema → extract → results/webhook. Single-node deploy <15 min.

Status (investigated on 2025-09-14)

- Backend hardening/webhooks/RBAC/quotas: [ ]
- Web settings + demo seed: [ ]
- SDKs (TS/Python) present scaffolds under `packages/clients*` but end-to-end scripts: [ ]

---

# Updated GitHub Issues (20)

1. **Repo/Infra:** mono-repo + dev mode; compose (PG/Redis/MinIO/Ollama)
2. **API Core:** DTOs, health routes, error format, request-id middleware
3. **Projects API/FE:** `/projects` list/create + overview page
4. **Files API:** upload endpoint (multipart, S3/MinIO/in-memory) + file listing
5. **Worker—Ingest:** OCR pipelines (DocTR/RapidOCR; Readability; docx; csv/xlsx) → `TextArtifact`
6. **Baseline Extractor (must implement):** regex/labels/tables + spans/confidence
7. **Extract Job (baseline, project-wide):** iterate all files, persist `ExtractionResult`
8. **Web—Ingest Page:** multi-upload, progress, statuses (do not remove route)
9. **Web—Results Viewer:** highlight spans; field panel with confidence & warnings
10. **LangExtract Wrapper:** chunker (1–3k tokens), merge, spans required
11. **Model Router:** Ollama fast pass → Groq precision escalation thresholds
12. **Workflows CRUD + Monitor:** create/list/activate per project; global `/workflows` monitor; `/projects/:id/extract` uses Active Workflow by default
13. **Validation Engine:** JSON-Schema + Rule DSL + re-read check
14. **Web—Review UI:** show rules, inline edit, re-validate, status badges
15. **Infer Schema API:** sample 2–5 files → draft JSON Schema + versioning
16. **Web—Format Page:** select schema OR infer → editor → save → re-run
17. **Webhooks + Exports:** project results CSV/JSON; `document.extracted|needs_review|failed`
18. **RBAC/Keys/Quotas:** org/project API keys; per-project rate limits
19. **SDKs:** TS + Python clients with end-to-end example script
20. **Demo Seed & Script:** “Create Demo Project” button + investor runbook

> **Rule for FE devs/agents:** Never delete or rename routes listed in AGENTS.md. Add components/pages only via PRs referencing issue IDs above.

---

# Acceptance Tests (copy into CI)

* **AT-01** Create project → upload 3 mixed files → ingest job finishes → each file has `TextArtifact` pages
* **AT-02** Baseline extract (no schema) → **non-empty fields with spans** rendered in `/results/[fileId]`
* **AT-03** Select schema `invoice.v1` → schema-controlled extract → ≥90% critical fields have spans on fixture invoices
* **AT-04** Rule fails → job `needs_review`; after inline edit → re-validate → `ok`
* **AT-05** Infer schema from 3 files → accept → extract across all files → results persisted
* **AT-06** SDK script can: create project → upload → infer schema → extract → fetch results → pass
* **AT-07** Project Overview shows Selected Format/Active Workflow when set; shows CTA when not set
* **AT-08** `POST /projects/:id/extract` without `workflow_id` uses Active Workflow if present; otherwise API returns error and UI prompts to select/create workflow

---

Acceptance Status (investigated on 2025-09-14)

- [ ] AT-01
- [ ] AT-02
- [ ] AT-03
- [ ] AT-04
- [ ] AT-05
- [ ] AT-06

# Demo Run (investor-ready)

1. Click **Create Demo Project** → auto-upload 5 fixtures.
2. Show **Ingest** progress; open one file’s **spans**.
3. **Infer Format** → accept schema; re-run **Extract**; show project-wide results.
4. Trigger a rule fail; fix in **Review UI**; re-validate to **ok**.
5. Download JSON; show webhook payload.

---
