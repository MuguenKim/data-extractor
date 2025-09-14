# Milestones (revised)

**M0. Repo & Infra (Day 1–2)**
**M1. Ingest + Baseline Extraction + Minimal UI (Week 1)**
**M2. LangExtract + Groq/Ollama Extraction Core (Week 2)**
**M3. Validation Engine + HITL Review UI (Week 3)**
**M4. Schema Inference Mode + Editor (Week 4)**
**M5. Public API + SDKs + Deploy + Beta (Week 5)**

---

## M0 — Repo & Infra (Day 1–2)

**Backend**

* Scaffold mono-repo: `apps/api`, `apps/worker`, `apps/web`, `packages/core`, `packages/clients`, `infrastructure`.
* Minimal dev mode (in-memory repos): runs **without** Postgres/Redis/S3.
* Optional Compose: Postgres, Redis, MinIO, Ollama.
* Health endpoints: `GET /healthz`, `GET /readyz`.

**Frontend**

* Next.js app bootstrapped with shadcn/ui, file upload, route stubs:

  * `/upload`, `/jobs/[id]`, `/workflows`, `/schemas`.

**Tests/Fixtures**

* Add 5 sample docs (PDF, image, DOCX, CSV, HTML) under `fixtures/`.

**DoD**

* `pnpm dev` runs API/Web/Worker locally w/out external deps.
* `docker compose up` works with services on.

---

## M1 — Ingest + Baseline Extraction + Minimal UI (Week 1)

**Goal:** upload any file → text + **offset map** + **basic field extraction** (no LLM) → visible in UI.

**Backend**

* Adapters:

  * PDF/Image → DocTR/RapidOCR (+ bbox), fallback Tesseract.
  * DOCX → python-docx; CSV/XLSX → pandas; HTML/URL → Readability+snapshot.
* Persist **DocumentText** (`doc_id`, `pages[]`, `char_offsets`, `bbox_map`).
* **Baseline extractor (rule-led)** in `packages/core/extractors/baseline`:

  * Regex/heuristics for invoice-ish fields: `invoice_number`, `date`, `currency`, `total`, and **table detector** that returns naive rows.
  * Emits **ResultEnvelope**: `fields.value|confidence|spans`, `warnings`, `status`.
* API v0:

  * `POST /ingest` → `{job_id, doc_id}`
  * `GET /docs/{doc_id}/text` → text + offsets (dev-only)
  * `POST /extract/baseline?schema_id=invoice.v1`

**Frontend**

* `/upload`: drag-drop, show ingest progress.
* `/jobs/[id]`: show **parsed text with highlights** for baseline fields (click field → scroll to span).
* Light theme, no auth yet.

**Tests/Fixtures**

* Golden tests for baseline rules on 5 fixtures.
* KPI logs: % pages OCR’d, span coverage.

**DoD**

* Upload → see baseline extracted fields with spans highlighted.
* 95% docs ingest without crash; offset map present.

### M1 — Updates (dev, implemented in this commit)

- Adapters added in `packages/core/src/ingest` with type-safe outputs:
  - `html` (existing) + `mhtml`, `eml` (basic MIME parsing; HTML parts converted to Markdown). `msg` placeholder with warning.
  - `csv` (existing) + `spreadsheet` adapter: CSV/TSV pass-through; binary XLSX/XLS/ODS return warning placeholder.
- `pdf` implemented via `pdfjs-dist` for digital text (per-page `pageMap`). If no selectable text, emits warning (OCR fallback not yet wired in dev).
- `docx` implemented via `mammoth` (raw text extraction).
  - `image` placeholder (OCR to be handled by worker; bboxMap field present for future tokens/lines).
- `presentation` implemented for PPTX via unzip+`fast-xml-parser` (extracts slide text nodes); ODP remains a placeholder.
- Offsets/Spans: extended `Span` to support sheet/row/col + in-cell offsets, DOM path + part id, and slide/shape indices; kept page/bbox for OCR. `pageMap` now populated for PDFs.
- `DocumentText` extended with optional `bboxMap` per page (tokens/lines) and adapter `notes` in `meta`.
- API `/ingest` now routes these types via `guessAdapter` and returns warnings explaining placeholders where applicable.

---

## M2 — LangExtract + Groq/Ollama Extraction Core (Week 2)

**Goal:** schema-controlled extraction with spans via LangExtract; model routing.

**Backend**

* `packages/core/langextract`:

  * Wrapper: `extract_with_langextract({schema, text, chunks, backend})`.
  * Chunker: 1–3k tokens, 10–15% overlap; per-chunk extraction; merge policy (confidence, label proximity).
* Model router:

  * **Ollama fast pass** (local) → **Groq precision pass** if `critical_confidence<thr`.
* Workflows:

  * `POST /workflows` `{schema_id|schema_json, backend, ocr_policy, lang_hint}`
  * `POST /extract?workflow_id=...` (LLM path)
  * `GET /jobs/{id}` returns **final ResultEnvelope**.

**Frontend**

* `/workflows`: create/edit workflow (choose schema `invoice.v1` initially).
* `/jobs/[id]`: side-by-side **field panel** (value, confidence) + **document viewer** (bbox highlight); download JSON.

**Tests**

* Contract tests: given `invoice.v1`, ≥90% critical fields have spans on fixtures.
* Load test: 20 pages/min single node.

**DoD**

* `/extract` returns strict JSON + spans via LangExtract for `invoice.v1`.

---

## M3 — Validation Engine + HITL Review UI (Week 3)

**Goal:** strict JSON-Schema + business rules + review/correction loop.

**Backend**

* JSON-Schema validation (types/format/required).
* **Rule DSL** (in `packages/core/validation/dsl.ts`):

  * `equals(sum(lines.amount), subtotal, tol)`
  * `equals(add(subtotal, tax_total), grand_total, tol)`
  * `in_set(currency, [...])`
  * `match(vat_id, regex)`
  * `date_le(issue_date, due_date)`
* Critical thresholds + **span re-read** check (small window OCR/text reread).
* Status pipeline: `ok | needs_review | failed`.
* Save **exemplars** (before/after) in pgvector (flag behind env if DB off).

**Frontend**

* `/review/[job]`:

  * List failed rules / low confidence.
  * Inline edit values; highlight spans; accept/save corrections.
  * Show rule re-check results live.

**Tests**

* Unit tests for DSL ops; e2e for “edit → rules pass → status ok”.
* Metrics: edit rate, first-pass yield.

**DoD**

* Rule failures route to Review; edits persist; KPIs logged.

---

## M4 — Schema Inference Mode + Editor (Week 4)

**Goal:** start without schema; infer, show, edit, save versioned workflow schema.

**Backend**

* `POST /infer_schema`:

  * Sample 2–5 docs → propose **draft JSON Schema** with `type`, `format`, `pattern`, `enum`, `required` (promote only if stable), `x-meta.example`.
* Versioning for **Workflow Schema** (`schema_id`, `version`).
* Store schema diffs and upgrade paths.

**Frontend**

* **Schema Editor** (JSON schema form + helpers):

  * toggle `required`, edit `pattern/enum`, set field `format`.
  * Preview extraction against one doc.

**Tests**

* Inference sanity tests: ≤10% manual edits on fixture set.
* Snapshot tests for schema JSON.

**DoD**

* User can infer → edit → save → reuse schema in workflow.

---

## M5 — Public API + SDKs + Deploy + Beta (Week 5)

**Backend**

* Harden endpoints: `/workflows`, `/infer_schema`, `/extract`, `/jobs/{id}`, `/validate`.
* Webhooks: `document.extracted`, `document.needs_review`, `document.failed`.
* Basic RBAC (org/project/API key), quotas/rate limits.

**Frontend**

* Add auth (Supabase/Auth.js), org/project switcher.
* Settings page: backend choice (Groq/Ollama), OCR policy, PII mask.

**SDKs**

* `packages/clients/js`: TS client with typed DTOs + examples.
* `packages/clients/py`: minimal Python client.

**Deploy**

* Single-node Fly.io/Render. CI: lint/test/build. Seed demo.

**DoD**

* External client runs end-to-end; webhook received; deploy <15 min.

---

## Expanded GitHub Issues (with FE/BE split)

1. **Infra:** Minimal dev mode + optional Compose (Postgres/Redis/MinIO/Ollama)
2. **Repo:** pnpm workspaces, shared tsconfig, Python packaging skeleton
3. **API (M0):** Health routes + request/response DTO base types
4. **Web (M0):** Next.js boot, shadcn setup, `/upload` stub
5. **Ingest (M1-BE):** PDF/Image OCR pipeline with bbox maps
6. **Ingest (M1-BE):** DOCX/CSV/XLSX/HTML adapters + unified `DocumentText`
7. **Baseline Extractor (M1-BE):** regex/table detector + envelope builder
8. **Web (M1-FE):** `/jobs/[id]` text viewer + span highlights; `/upload` end-to-end
9. **LangExtract (M2-BE):** wrapper + chunker + merge; spans required
10. **Model Router (M2-BE):** Ollama→Groq escalation + thresholds
11. **Workflows API (M2-BE):** CRUD + `/extract?workflow_id=`
12. **Web (M2-FE):** Workflows page + job viewer (field panel + bbox highlight)
13. **Validation DSL (M3-BE):** engine + JSON-Schema validation + span re-read
14. **Web (M3-FE):** Review UI with inline edits + rule outcomes
15. **Schema Inference (M4-BE):** `/infer_schema` + versioning
16. **Web (M4-FE):** Schema Editor (JSON form, preview run)
17. **API Hardening (M5-BE):** RBAC, rate limits, webhooks
18. **SDKs (M5):** TS + Python clients + examples
19. **Deploy/CI (M5):** Fly/Render configs, CI pipeline, demo seed
20. **Goldens & KPIs:** test datasets, metrics ingestion, dashboard stub

---

## Clear DoD per Milestone (frontend included)

* **M1**

  * FE: Upload UI + Job page highlighting baseline fields.
  * BE: Ingest + Baseline extractor returns spans.
  * Tests: Golden regex hits; no crashes on 95% inputs.

* **M2**

  * FE: Workflows list/detail; JSON download.
  * BE: LangExtract with model routing; ≥90% critical spans.
  * Tests: Contract tests per schema.

* **M3**

  * FE: Review UI edits + rule results; status badges.
  * BE: Rule DSL, JSON-Schema check, span re-read.
  * Tests: Edit → pass pipeline; metrics logged.

* **M4**

  * FE: Schema Editor with live preview, version save.
  * BE: `/infer_schema` stable; versioning.
  * Tests: Inferred schema requires ≤10% manual edit on fixtures.

* **M5**

  * FE: Auth + settings; webhook test page.
  * BE: RBAC, quotas, webhooks; SDKs.
  * Tests: End-to-end via SDK; deploy success.

---

## Extra clarity (what “baseline extractor” includes in M1)

* Regex set (date, currency, invoice id, totals).
* Table detector (line items by row separators / numeric columns).
* Confidence scoring: regex strength + proximity to labels.
* Spans: char ranges + optional bbox from OCR mapper.
* Output already in **ResultEnvelope** so UI doesn’t change later.
