import { ResultEnvelope, WorkflowSchema, ExtractionChunk } from "../../types";
import { getLogger } from "../../logger";

interface CallArgs {
  schema: WorkflowSchema;
  chunk: ExtractionChunk;
  model: string;
  host?: string;
}

export async function callOllamaLangExtract({ schema, chunk, model, host }: CallArgs): Promise<ResultEnvelope> {
  // Require host; if missing, surface a clear error
  const log = getLogger('core').child({});
  if (!host) throw new Error("OLLAMA_HOST missing; cannot call Ollama backend");

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(schema, chunk);
  const url = host.replace(/\/$/, "") + "/api/generate";

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
        options: { temperature: 0.2 },
        format: "json",
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      log.warn('backend.ollama.http_error', { status: resp.status, chunk_id: chunk.id, model });
      throw new Error(`Ollama HTTP ${resp.status}: ${body?.slice(0,120)}`);
    }
    const data = await resp.json();
    const content = data?.response ?? "";
    return normalizeModelOutput(content, schema, chunk);
  } catch (e: any) {
    log.warn('backend.ollama.exception', { error: e?.message || String(e), chunk_id: chunk.id, model });
    throw e;
  }
}

function buildSystemPrompt(): string {
  return [
    "You are LangExtract, an information extraction model.",
    "Extract fields strictly according to the provided SCHEMA.",
    "Return ONLY valid JSON with this shape:",
    '{"fields": {"<name>": {"value": any|null, "confidence": number, "spans":[{"start": number, "end": number}]}}, "warnings": string[]}',
    "- Confidence must be 0..1.",
    "- spans.start is inclusive; spans.end is exclusive.",
    "- Offsets are relative to the CHUNK text provided (not tokens).",
    "- If unsure or no span found, set value=null and include a warning.",
  ].join("\n");
}

function buildUserPrompt(schema: WorkflowSchema, chunk: ExtractionChunk): string {
  const schemaJson = JSON.stringify({ id: schema.id, title: schema.title, fields: schema.fields }, null, 2);
  return [
    `SCHEMA:\n${schemaJson}`,
    `CHUNK_META: {"id":"${chunk.id}","start":${chunk.start},"end":${chunk.end}}`,
    "CHUNK:",
    chunk.text,
  ].join("\n\n");
}

async function normalizeModelOutput(raw: string, schema: WorkflowSchema, chunk: ExtractionChunk): Promise<ResultEnvelope> {
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/[\{\[].*[\}\]]/s);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Ollama returned non-JSON or invalid JSON");
  }
  const outFields: Record<string, any> = {};
  const warnings: string[] = Array.isArray(parsed.warnings) ? parsed.warnings.slice() : [];
  for (const f of schema.fields) {
    const cand = parsed.fields?.[f.name];
    if (!cand || typeof cand !== "object") {
      outFields[f.name] = { value: null, confidence: 0, spans: [], warnings: ["missing_field"] };
      warnings.push(`missing:${f.name}`);
      continue;
    }
    const val = cand.value ?? null;
    const conf = clamp01(Number(cand.confidence ?? 0));
    const spans = Array.isArray(cand.spans) ? cand.spans.map((s: any) => normalizeSpan(s, chunk)) : [];
    const warn = Array.isArray(cand.warnings) ? cand.warnings : [];
    outFields[f.name] = { value: val, confidence: conf, spans, warnings: warn };
  }
  return {
    fields: outFields,
    warnings,
    validation: { rules_passed: [], rules_failed: [] },
    status: "ok",
    stats: { critical_confidence: 0, backend: "ollama" },
  };
}

function normalizeSpan(s: any, chunk: ExtractionChunk) {
  const start = Math.max(0, Number(s?.start ?? 0));
  const end = Math.max(start, Number(s?.end ?? start));
  return { start: chunk.start + start, end: chunk.start + end };
}

function clamp01(n: number): number { return isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; }

