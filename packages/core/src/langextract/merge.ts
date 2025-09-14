import { FieldResult, ResultEnvelope, SchemaField } from "../types";

export interface MergeInput {
  perChunk: ResultEnvelope[];
  schemaFields: SchemaField[];
}

// simple merge: highest confidence wins; tie break by earliest span start
export function mergeResults({ perChunk, schemaFields }: MergeInput): ResultEnvelope {
  const fields: Record<string, FieldResult> = {};
  const warnings: string[] = [];

  for (const field of schemaFields) {
    let best: FieldResult | undefined;
    for (const res of perChunk) {
      const candidate = res.fields[field.name];
      if (!candidate) continue;
      if (candidate.value === null) continue;
      if (!best) {
        best = candidate;
        continue;
      }
      if (candidate.confidence > best.confidence) {
        best = candidate;
      } else if (candidate.confidence === best.confidence) {
        const a = earliestSpan(candidate);
        const b = earliestSpan(best);
        if (a < b) best = candidate;
      }
    }

    if (!best) {
      fields[field.name] = {
        value: null,
        confidence: 0,
        spans: [],
        warnings: ["no_span_or_value"],
      };
      warnings.push(`missing:${field.name}`);
    } else {
      fields[field.name] = best;
      if (!best.spans || best.spans.length === 0) {
        fields[field.name].value = null;
        fields[field.name].warnings = [
          ...(best.warnings || []),
          "missing_span",
        ];
        warnings.push(`missing_span:${field.name}`);
      }
    }
  }

  const criticalConf = criticalConfidence(fields, schemaFields);
  return {
    fields,
    warnings,
    validation: { rules_passed: [], rules_failed: [] },
    status: "ok",
    stats: { critical_confidence: criticalConf, backend: "mock" },
  };
}

function earliestSpan(fr: FieldResult): number {
  if (!fr.spans || fr.spans.length === 0) return Number.MAX_SAFE_INTEGER;
  return Math.min(...fr.spans.map((s) => s.start));
}

function criticalConfidence(
  fields: Record<string, FieldResult>,
  schemaFields: SchemaField[]
): number {
  const crits = schemaFields.filter((f) => f.critical);
  if (crits.length === 0) return avg(Object.values(fields).map((f) => f.confidence));
  return avg(
    crits.map((f) => fields[f.name]?.confidence ?? 0)
  );
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

