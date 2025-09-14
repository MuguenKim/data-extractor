import { ResultEnvelope, WorkflowSchema, ExtractionChunk } from "../../types";
import { extractLocal } from "../local";

interface CallArgs {
  schema: WorkflowSchema;
  chunk: ExtractionChunk;
  model: string;
  host?: string;
}

export async function callOllamaLangExtract({ schema, chunk, model, host }: CallArgs): Promise<ResultEnvelope> {
  // If no host, fall back to local extractor for dev-min
  if (!host) return extractLocal(schema, chunk);

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
      return extractLocal(schema, chunk);
    }
    const data = await resp.json();
    const content = data?.response ?? "";
    return normalizeModelOutput(content, schema, chunk);
  } catch {
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
  return [
    `SCHEMA:\n${schemaJson}`,
    `CHUNK_META: {"id":"${chunk.id}","start":${chunk.start},"end":${chunk.end}}`,
    "CHUNK:",
    chunk.text,
  ].join("\n\n");
}

function normalizeModelOutput(raw: string, schema: WorkflowSchema, chunk: ExtractionChunk): ResultEnvelope {
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
    stats: { critical_confidence: 0, backend: "ollama" },
  };
}

function normalizeSpan(s: any, chunk: ExtractionChunk) {
  const start = Math.max(0, Number(s?.start ?? 0));
  const end = Math.max(start, Number(s?.end ?? start));
  return { start: chunk.start + start, end: chunk.start + end };
}

function clamp01(n: number): number { return isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; }

