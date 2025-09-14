# AGENTS.md — Structured Data Extractor (PoC-ready)

> Single source of truth for engineers and AI agents. Do not remove pages/routes defined here. Implement logic; no stubs unless explicitly marked.

## Mission

Turn **uploaded files → extracted text → proposed/confirmed schema → validated structured JSON** for an entire **project**. PII is **not masked**.

## Core User Flow (must match UI & API)

1. **Create Project**
2. **Ingest Data** (upload 1..N files; extract text/layout; persist both)
3. **Choose Format**: user selects a schema **or** clicks **Infer Format** (system proposes one; user edits/accepts)
4. **Extract & Validate** (run over **all project files**; show results, spans, rule checks)

## Data/Domain Model

* **Project** `{id, name, created_by, created_at}`
* **File** `{id, project_id, name, mime, pages, storage_uri, status: uploaded|processed|failed}`
* **TextArtifact** `{file_id, page_no, text, char_offsets, bbox_map}`
* **Schema** `{id, project_id|null, name, version, json_schema, kind: user|inferred}`
* **Workflow** `{id, project_id, schema_id, backend: groq|ollama, ocr_policy, language_hint}`
* **Job** `{id, project_id, type: ingest|infer_schema|extract, status, metrics, created_at}`
* **ExtractionResult** `{file_id, schema_id, result_json, warnings, validation, status}`

## Tech Pillars

* Ingest: DocTR/RapidOCR → text + bbox; Readability for HTML; python-docx; pandas for CSV/XLSX
* LLMs: **Groq** (precision) and **Ollama** (fast pass), both via LangExtract
* Storage: Postgres (prod), in-memory (dev-min), S3/MinIO for files/artifacts
* Queue: BullMQ (Node) or RQ (Python). Workers perform CPU/OCR/LLM tasks.

## Repo Layout (stable)

```
/apps/web      # Next.js UI (must keep routes below)
/apps/api      # REST API (project/file/schema/workflow/jobs)
/apps/worker   # queue consumers: ingest, infer, extract, validate
/packages/core # extractors (baseline+LE), validators, DTOs, schema tools
/packages/clients # JS/TS + Python SDKs
/infrastructure  # docker, compose, env, deploy
/fixtures        # sample docs and golden outputs
```

## UI — Pages (do not delete/rename)

* `/projects` — list/create
* `/projects/[id]` — project overview (counts, last runs)
* `/projects/[id]/ingest` — **upload** & ingest status per file (progress)
* `/projects/[id]/format` — **Select Schema** OR **Infer Format** → **Schema Editor** → **Save schema**
* `/projects/[id]/extract` — **Run Extraction** → job status → per-file result table
* `/projects/[id]/results/[fileId]` — document viewer: values, confidence, spans, rules
* `/settings` — backend (groq/ollama), OCR policy, language hint

## Backends/Endpoints (stable contracts)

* `POST /projects` → {id}
* `GET /projects/:id` → summary
* `POST /projects/:id/files` (multipart) → creates **Ingest Job**
* `GET /projects/:id/files` → list with statuses
* `POST /projects/:id/schemas` → save user schema
* `POST /projects/:id/infer_schema` → creates **Infer Job**; returns **draft schema** (on completion)
* `POST /projects/:id/workflows` → bind schema + options (backend, OCR policy, lang)
* `POST /projects/:id/extract?workflow_id=...` → creates **Extract Job** for **all files**
* `GET /jobs/:id` → status + metrics
* `GET /projects/:id/results` → per-file extraction summaries
* `GET /projects/:id/results/:fileId` → full ResultEnvelope (fields, spans, validation)

### DTO snippets (strict)

```ts
// ResultEnvelope
{
  schema_id: "invoice.v1",
  file_id: "uuid",
  fields: {
    invoice_number: { value: "INV-2025-003", confidence: 0.92, spans: [{page:1,start:234,end:245}] },
    lines: [
      { desc:"Clutch kit", qty:1, unit_price:249.9, confidence:0.88, spans:[...] }
    ],
    grand_total: { value: 297.38, confidence: 0.99, spans:[...] }
  },
  warnings: ["low confidence on lines[2].unit_price"],
  validation: {
    schema_valid:true,
    rules_passed:["sum(lines)==subtotal","subtotal+tax==grand_total"],
    rules_failed:[]
  },
  status: "ok" // ok|needs_review|failed
}
```

## Extraction Logic (implement, no placeholders)

* **Baseline extractor (M1)**: regex/label heuristics (invoice no., dates, currency, totals, simple table rows). Returns **spans** (char offsets; bbox if available). Confidence = regex strength + label proximity.
* **LangExtract extractor (M2)**: chunk text (1–3k tokens, 10–15% overlap), run schema-controlled extraction with **spans required**. Merge per field: highest confidence, tie-break by label proximity.

## Validation (M3)

* **Layer 1:** JSON-Schema (types/required/format)
* **Layer 2:** Rule DSL: `equals`, `add`, `in_set`, `match`, `date_le`
* **Layer 3:** Grounding check: re-read span window for low-confidence

## PII Policy

* **No masking.** Store and return data exactly as provided.

## Worker Pipeline (project-wide)

* **Ingest Job**: upload → OCR/parse → persist `TextArtifact` per page → file.status=processed
* **Infer Job**: sample 2–5 project files → propose **draft schema** → store as `Schema(kind="inferred")`
* **Extract Job**: for each processed file → run extractor (LangExtract or baseline) → validate → persist `ExtractionResult`

## Guardrails for Agents

* Do **not** remove routes/pages listed above.
* Implement baseline and LangExtract extractors **fully**; no TODO-only modules.
* Always return **spans**; if none, set value `null` + warning.
* Project-level **Extract** must iterate **all files** in the project.

---

