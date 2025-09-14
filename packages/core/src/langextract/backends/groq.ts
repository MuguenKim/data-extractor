import { ResultEnvelope, WorkflowSchema, ExtractionChunk } from "../../types";
import { extractLocal } from "../local";
import { getLogger } from "../../logger";

interface CallArgs {
  schema: WorkflowSchema;
  chunk: ExtractionChunk;
  model: string;
  apiKey?: string;
}

export async function callGroqLangExtract({ schema, chunk, model, apiKey }: CallArgs): Promise<ResultEnvelope> {
  // If no API key, fall back to local extractor to keep dev-min functional.
  const log = getLogger('core').child({});
  if (!apiKey) {
    log.warn('backend.groq.no_api_key_fallback', { chunk_id: chunk.id, model });
    return extractLocal(schema, chunk);
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(schema, chunk);

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      log.warn('backend.groq.http_error_fallback', { status: resp.status, chunk_id: chunk.id, model });
      // Network reachable but API rejected; fall back to local
      return extractLocal(schema, chunk);
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return normalizeModelOutput(content, schema, chunk);
  } catch (e: any) {
    // Network not available or other error; fall back
    log.warn('backend.groq.exception_fallback', { error: e?.message || String(e), chunk_id: chunk.id, model });
    return extractLocal(schema, chunk);
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
  const truncated = chunk.text;
  return [
    `SCHEMA:\n${schemaJson}`,
    `CHUNK_META: {"id":"${chunk.id}","start":${chunk.start},"end":${chunk.end}}`,
    "CHUNK:",
    truncated,
  ].join("\n\n");
}

async function normalizeModelOutput(raw: string, schema: WorkflowSchema, chunk: ExtractionChunk): Promise<ResultEnvelope> {
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to extract JSON substring
    const m = raw.match(/[\{\[].*[\}\]]/s);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
    }
  }

  if (!parsed || typeof parsed !== "object") {
    // Fall back to local if model output is unusable
    return extractLocal(schema, chunk);
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
    stats: { critical_confidence: 0, backend: "groq" },
  };
}

function normalizeSpan(s: any, chunk: ExtractionChunk) {
  const start = Math.max(0, Number(s?.start ?? 0));
  const end = Math.max(start, Number(s?.end ?? start));
  // Convert chunk-relative to document-absolute
  return { start: chunk.start + start, end: chunk.start + end };
}

function clamp01(n: number): number { return isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; }

