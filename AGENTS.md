# AGENTS.md — Structured Data Extractor (LangExtract • Groq • Ollama)

> A single source of truth for AI coding agents working on this repo.
> Follow the rules. Do not invent endpoints, files, or configs not listed here.

---

## Mission & Scope

* **Goal:** Extract **strict, validated JSON** from any document (PDF, image, DOCX, HTML/URL, CSV, TXT), with **spans/offsets**, **confidence**, and **rule-based validation**.
* **Tech pillars:** **LangExtract** (schema-controlled extraction), **Groq** + **Ollama** LLM backends, dual OCR, human review.
* **Two modes:**

  1. **Schema-provided** → normalize to user’s JSON Schema.
  2. **Schema-inferred** → we propose a draft schema from samples/brief; user edits & saves as a **Workflow Schema**.
* **Non-goals:** We do **not** manage downstream ERPs/accounting; only extraction + validation + export.

---

## Repo Layout (canonical)

```
/apps/api          # FastAPI/Express handlers, auth, webhooks
/apps/worker       # queue consumers: OCR, chunk, extract, validate, export
/apps/web          # Next.js UI: upload, review, schema editor
/packages/core     # types, JSON-Schema, validators, rules DSL, LangExtract wrappers
/packages/clients  # JS/TS + Python SDK
/infrastructure    # Docker, compose, deploy, env templates
```

---

## Setup Commands

* Install deps: `pnpm i` (JS) • `uv sync` or `pip install -e .` (Python)
* Dev: `pnpm --filter @web dev` • `pnpm --filter @api dev` • `pnpm --filter @worker dev`
* Lint/Test: `pnpm test` • `pytest -q`
* Services (dev, optional): `docker compose up` (Ollama required for local LLM; Postgres/Redis/MinIO are optional for persistence/scale)

---

## Environment

```
# minimal dev: no external DB/Redis/S3 required
# llm backends (set one or both)
GROQ_API_KEY=...
OLLAMA_HOST=http://localhost:11434

# extraction defaults
DEFAULT_BACKEND=groq          # groq|ollama
DEFAULT_MODEL_GROQ=llama-3.1-70b-versatile
DEFAULT_MODEL_OLLAMA=llama3.1:8b-instruct
CONFIDENCE_THRESHOLD_CRITICAL=0.90

# optional (prod/scale): enable persistence & queue
DATABASE_URL=postgres://...
REDIS_URL=redis://...
S3_ENDPOINT=...
S3_BUCKET=documents
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

---

## Core Concepts

* **Workflow** = `{ schema, validators, backend, OCR policy, language hint, export targets }`
* **Result JSON (always):**

  * `fields.{name}.value`
  * `fields.{name}.confidence`
  * `fields.{name}.spans[]` (page, start, end or bbox)
  * `warnings[]`
  * `validation.{rules_passed[], rules_failed[]}`
  * `status: ok | needs_review | failed`

---

## Agents & Responsibilities

1. **Orchestrator Agent**

   * Creates Job plan: ingest → preprocess → chunk → extract → merge → validate → export.
   * Retries only via listed backoffs; no infinite loops.

2. **Ingest/OCR Agent**

   * Normalizes input to text + layout map.
   * PDF/Image → DocTR/RapidOCR (fallback Tesseract).
   * HTML/URL → Readability + DOM text; snapshot saved.

3. **Schema Inference Agent (for schema-inferred mode)**

   * Samples 2–5 docs; proposes **draft JSON Schema** with: `type`, `format`, `pattern`, `enum`, `required`, and `x-meta.example`.
   * Promotes fields that are stable across samples to `required`.
   * Never mark `required` if field has >10% nulls across samples.

4. **Extraction Agent (LangExtract wrapper)**

   * Runs schema-controlled extraction **per chunk** using selected LLM backend.
   * Must return spans; if span missing → set field `value=null` + add warning.

5. **Merge Agent**

   * Consolidates chunk-level outputs by: higher confidence wins; tie-break by proximity to headings/labels; preserve all spans.

6. **Validation Agent**

   * **Layer 1:** JSON-Schema validation (types, formats, required).
   * **Layer 2:** Business rules (sum lines, tax math, currency codes, regex for VAT/IBAN/phone).
   * **Layer 3:** Grounding check (re-parse span window to confirm low-confidence values).

7. **Review Agent (HITL)**

   * Surfaces low-confidence/failed rules to UI with highlighted spans; applies human fixes; stores before/after pairs as exemplars.

8. **Export/Billing Agent**

   * Exports to JSON/CSV/webhook/DB.
   * Tracks pages, tokens, retries by org/workflow for quota & billing.

---

## Tools & Models

* **LLMs:**

  * `groq` (primary precision pass) via `DEFAULT_MODEL_GROQ`.
  * `ollama` (local fast pass) via `DEFAULT_MODEL_OLLAMA`.
* **OCR:** DocTR → RapidOCR; fallback Tesseract.
* **Vector/Memory:** pgvector for exemplars & vendor patterns (optional; not required for MVP).
* **Queue:** BullMQ/Redis (Node) or RQ (Python). In dev without Redis, use an in-process queue. Use exponential backoff (max 3).

---

## Endpoints (stable)

* `POST /workflows` → create/update (schema or “infer” flag)
* `POST /infer_schema` → files + optional brief → returns draft schema
* `POST /extract?workflow_id=...` → files|url|text → `job_id`
* `GET /jobs/{id}` → status + result
* `POST /validate` → run rule DSL on arbitrary JSON
* Webhooks: `document.extracted`, `document.needs_review`, `document.failed`

---

## Prompts / Operational Rules (must follow)

* **Never** hallucinate values; if not grounded by span → return `null` + warning.
* Prefer **label-led extraction** (“Invoice No.”, “Total TTC”, etc.) before free-text guesses.
* Keep chunks \~1–3k tokens with 10–15% overlap. Merge deterministically.
* Escalate: if `critical_confidence < threshold` → rerun with stricter prompt or higher-capacity Groq model.

---

## Validation DSL (mini)

* `equals(sum(lines.amount), subtotal, tol=0.01)`
* `equals(add(subtotal, tax_total), grand_total, tol=0.01)`
* `in_set(currency, ["USD","EUR","TND"])`
* `match(vat_id, "^[A-Z0-9]{6,}$")`
* `date_le(issue_date, due_date)`

---

## Security & PII

* Mask PII by default (names, phone, IBAN) at storage boundary unless workflow opts out.
* Row-level tenancy (org\_id); artifact access requires org scope + job permission.
* All exports logged with checksum + requester.

---

## Testing & KPIs

* Golden sets per schema; report **field accuracy**, **edit rate**, **first-pass yield**, **AHT**.
* A job **fails** if JSON-Schema invalid **or** any critical rule fails.

---

## When to Use LangGraph

* **MVP:** not required.
* Add only for multi-tool recovery, doc-type routing, or self-heal loops once baseline is stable.

---

## Glossary

* **Span:** source character range or bbox proving the value.
* **Critical field:** totals, dates, IDs, currency.
* **Workflow Schema:** versioned JSON Schema bound to a workflow.

---

## References for Agents (format inspiration)

* AGENTS.md overview & examples (structure & intent). ([agents.md][1])
* Agents.md site (purpose and best practices). ([Agents.md Guide for OpenAI Codex][2])

---

**Contact/Owner:** Walid (Maintainer). PRs must include unit tests for new validators and a golden-set diff.

[1]: https://agents.md/?utm_source=chatgpt.com "AGENTS.md"
[2]: https://agentsmd.net/?utm_source=chatgpt.com "Agents.md Guide for OpenAI Codex - Enhance AI Coding"
