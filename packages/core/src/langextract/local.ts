import { ExtractionChunk, FieldResult, ResultEnvelope, SchemaField, WorkflowSchema } from "../types";

// Local label-led extractor for offline dev. Handles simple invoice-like schemas.
// This is NOT an LLM; it uses regexes and label proximity to extract.

type RegexMap = Record<string, RegExp[]>;

const defaultPatterns: RegexMap = {
  invoice_number: [/invoice\s*(no\.?|number)\s*[:#]?\s*([A-Z0-9\-]+)/i],
  issue_date: [/(date|issue date)\s*[:#]?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})/i],
  due_date: [/(due\s*date)\s*[:#]?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})/i],
  currency: [/(currency|curr\.)\s*[:#]?\s*([A-Z]{3})/i],
  subtotal: [/(subtotal)\s*[:#]?\s*([$€£]?\s*[0-9,]+\.?[0-9]*)/i],
  tax_total: [/((vat|tax)(\s*total)?)\s*[:#]?\s*([$€£]?\s*[0-9,]+\.?[0-9]*)/i],
  grand_total: [/(total\s*(due|amount)?|amount\s*due)\s*[:#]?\s*([$€£]?\s*[0-9,]+\.?[0-9]*)/i],
  vat_id: [/(vat|tax)\s*(id|no\.?|number)\s*[:#]?\s*([A-Z0-9]{6,})/i],
};

function parseMoney(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.,-]/g, "");
  const normalized = cleaned.replace(/,/g, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function makeSpan(text: string, start: number, end: number) {
  return { start, end };
}

export async function extractLocal(
  schema: WorkflowSchema,
  chunk: ExtractionChunk
): Promise<ResultEnvelope> {
  const fields: Record<string, FieldResult> = {};
  const warnings: string[] = [];

  for (const f of schema.fields) {
    const name = f.name;
    const hints = f.label_hints ?? [];
    const patterns = defaultPatterns[name] ?? [];

    let best: FieldResult | undefined;

    // try hint-anchored proximity search: look for hint and read next token(s)
    for (const hint of hints) {
      const idx = chunk.text.toLowerCase().indexOf(hint.toLowerCase());
      if (idx >= 0) {
        const window = chunk.text.slice(idx, Math.min(idx + 200, chunk.text.length));
        const m = /(\S{2,})\s*$/m.exec(window);
        if (m) {
          const raw = m[1];
          const start = idx + window.lastIndexOf(raw);
          const end = start + raw.length;
          best = {
            value: castValue(f, raw),
            confidence: 0.5,
            spans: [makeSpan(chunk.text, chunk.start + start, chunk.start + end)],
            warnings: [],
          };
          break;
        }
      }
    }

    // regex based
    if (!best && patterns.length > 0) {
      for (const rx of patterns) {
        const m = rx.exec(chunk.text);
        if (m) {
          const raw = m[m.length - 1];
          const start = m.index + (m[0].lastIndexOf(raw));
          const end = start + raw.length;
          best = {
            value: castValue(f, raw),
            confidence: 0.7,
            spans: [makeSpan(chunk.text, chunk.start + start, chunk.start + end)],
            warnings: [],
          };
          break;
        }
      }
    }

    if (!best) {
      fields[name] = { value: null, confidence: 0, spans: [], warnings: ["not_found"] };
      warnings.push(`missing:${name}`);
    } else {
      fields[name] = best;
    }
  }

  return {
    fields,
    warnings,
    validation: { rules_passed: [], rules_failed: [] },
    status: "ok",
    stats: { critical_confidence: 0, backend: "mock" },
  };
}

function castValue(field: SchemaField, raw: string): any {
  switch (field.type) {
    case "number":
    case "integer":
      return parseMoney(raw);
    case "boolean":
      return /^(true|yes|1)$/i.test(raw);
    case "date":
      // passthrough; UI can format
      return raw;
    default:
      return raw;
  }
}

