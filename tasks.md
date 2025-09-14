# Milestones (final)

## Progress Tracker

- Last Updated: 2025-09-14

- Milestones:
  - [ ] M0. Repo & Infra (Day 1–2)
- [x] M1. Ingest + Baseline Extraction + Functional UI (Week 1)
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
- [ ] `docker compose up` web healthcheck passes (missing `apps/web/pages/api/health.ts`)

## M1 — Ingest + Baseline Extraction + Functional UI

**Backend**

* File adapters (PDF/Image, DOCX, CSV/XLSX, HTML/URL) → `TextArtifact`
* Baseline extractor implemented (regex/labels/tables) + spans + confidence
* Endpoints: projects, files, ingest job, baseline extract (per project)

**Frontend**

* `/projects` (create); `/projects/[id]` (summary)
* `/projects/[id]/ingest` (multi-upload, progress, file table)
* `/projects/[id]/extract` (Run Baseline Extraction for **all files**; status)
* `/projects/[id]/results/[fileId]` (document viewer with **highlighted spans**)

**Tests**

Golden Tests (M1) — implement in CI with fixture-driven assertions. Use ResultEnvelope-like JSON for expected fields where applicable; store expected under `fixtures/golden/baseline/`.

- M1-GT-01 Ingest TXT: upload `fixtures/invoice.txt` → `TextArtifact` created with page_no=1, non-empty `text`, monotonically increasing `char_offsets`.
- M1-GT-02 Ingest HTML: upload `fixtures/invoice.html` → Readability adapter returns cleaned `text` (≥1k chars not required; just non-trivial), preserves order; `TextArtifact` persisted.
- M1-GT-03 Ingest CSV: upload `fixtures/invoice.csv` → rows serialized to `text` with delimiter awareness; `TextArtifact` exists; at least 3 logical rows detected in downstream table extractor.
- M1-GT-04 Ingest Image (OCR): upload `fixtures/invoice1.png`, `fixtures/invoice2.png` → status `processed`; `TextArtifact` pages created. Dev-min may be flaky; project ingest success ≥95% across all fixtures.
- M1-GT-05 Ingest PDF (OCR): upload `fixtures/invoice3.pdf`, `fixtures/invoice4.pdf` → status `processed`; `TextArtifact` pages ≥1 each; bbox_map optional.
- M1-GT-06 Baseline fields (core): run baseline extract for project → each file yields non-empty fields with spans: `invoice_number`, `invoice_date`, `vendor`/`seller`, `grand_total`. Each field: `value` not null, `confidence` in [0,1], `spans` non-empty with valid `{page,start,end}` within doc length.
- M1-GT-07 Table lines: lines parsed from at least one of HTML/CSV/PDF/Image; each line item has `desc`, `qty` (number), `unit_price` (number). At least one line has spans on numeric fields; warnings produced for any missing spans per policy.
- M1-GT-08 Project-wide extract: `POST /projects/:id/extract` runs over all `processed` files; one `ExtractionResult` per file persisted; no file skipped.
- M1-GT-09 API contracts: `POST /projects`, `POST /projects/:id/files`, `GET /projects/:id/files`, `POST /projects/:id/extract`, `GET /projects/:id/results` adhere to response shapes; file.status transitions `uploaded` → `processed`.
- M1-GT-10 UI smoke: routes `/projects`, `/projects/[id]`, `/projects/[id]/ingest`, `/projects/[id]/extract`, `/projects/[id]/results/[fileId]` render 200; results viewer highlights spans.
- M1-GT-11 PII policy: returned values are unmasked and match source text within span windows.
- M1-GT-12 Confidence sanity: `invoice_number` and `grand_total` confidences ≥0.5 on at least one non-image/non-PDF fixture; confidences within [0,1] for all fields.

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
  - [x] Required routes `/projects`, `/projects/[id]`, `/ingest`, `/results/[fileId]`
  - [x] Results viewer with highlighted spans
- Tests
  - [x] Golden tests and ingest success metrics implemented (see `tests/*` and `fixtures/golden/baseline/*`)
- DoD
  - [x] End-to-end upload → spans in results for all project files (dev-min JSON ingest)

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
  - [x] Workflows create/bind (`POST /workflows` in API)
  - [x] Extraction endpoint (`POST /extract?workflow_id=...`)
  - [ ] Groq/Ollama calls implemented (currently placeholders that throw)
- Frontend
  - [ ] `/projects/[id]/format` route not present (demo page `/workflows` exists)
  - [x] Job page allows JSON download of result
- Tests
  - [ ] Contract tests for spans coverage
- DoD
  - [ ] Project-wide schema-controlled extraction with spans

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
12. **Workflows CRUD:** bind schema/backend per project; `/extract?workflow_id=...`
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
