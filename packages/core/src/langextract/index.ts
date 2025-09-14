import { Backend, ExtractWithLangExtractArgs, ResultEnvelope } from "../types";
import { chunkText } from "./chunker";
import { mergeResults } from "./merge";
import { extractViaBackend } from "./router";
import { getLogger } from "../logger";

export async function extract_with_langextract(
  args: ExtractWithLangExtractArgs
): Promise<ResultEnvelope> {
  const log = getLogger('core').child({});
  const chunks = args.chunks && args.chunks.length > 0 ? args.chunks : chunkText(args.text);
  log.info('extract.start', { schema_id: (args.schema as any)?.id, fields: args.schema?.fields?.length, chunks: chunks.length, backend: args.backend });

  const perChunk: ResultEnvelope[] = [];
  let usedBackend: Backend = "mock";
  let usedModel: string | undefined = undefined;

  // First pass
  for (const chunk of chunks) {
    const { result, backend, model } = await extractViaBackend({
      backend: args.backend,
      schema: args.schema,
      chunk,
      modelHints: args.modelHints,
    });
    usedBackend = backend;
    usedModel = model;
    perChunk.push(result);
    log.debug('extract.chunk.done', { chunk_id: chunk.id, backend, model, warnings: result.warnings?.length });
  }

  let merged = mergeResults({ perChunk, schemaFields: args.schema.fields });
  merged.stats = (merged.stats as any) ?? ({ backend: usedBackend, critical_confidence: 0 } as any);
  (merged.stats as any).backend = usedBackend;
  if (usedModel) (merged.stats as any).model = usedModel;
  log.info('extract.merge.done', { backend: usedBackend, model: usedModel, critical_confidence: (merged.stats as any)?.critical_confidence, warnings: merged.warnings?.length });

  // Escalation: if critical_confidence < threshold, try Groq precision pass
  const threshold = Number(process.env.CONFIDENCE_THRESHOLD_CRITICAL ?? "0.9");
  const needsEscalation = (merged.stats as any)?.critical_confidence !== undefined && (merged.stats as any).critical_confidence < threshold;
  const defaultBackend = (process.env.DEFAULT_BACKEND as any) ?? "groq";

  if (needsEscalation && defaultBackend !== "groq") {
    log.warn('extract.escalate', { from_backend: usedBackend, to_backend: 'groq', critical_confidence: (merged.stats as any)?.critical_confidence, threshold });
    const perChunkGroq: ResultEnvelope[] = [];
    for (const chunk of chunks) {
      const { result } = await extractViaBackend({ backend: "groq", schema: args.schema, chunk, modelHints: args.modelHints });
      perChunkGroq.push(result);
    }
    const mergedGroq = mergeResults({ perChunk: perChunkGroq, schemaFields: args.schema.fields });
    merged = pickHigherConfidence(merged, mergedGroq);
    merged.stats = (merged.stats as any) ?? ({ backend: usedBackend, critical_confidence: 0 } as any);
    (merged.stats as any).backend = "groq";
    log.info('extract.escalate.done', { backend: 'groq', critical_confidence: (merged.stats as any)?.critical_confidence });
  }

  return merged;
}

function pickHigherConfidence(a: ResultEnvelope, b: ResultEnvelope): ResultEnvelope {
  const out: ResultEnvelope = {
    fields: {},
    warnings: [...a.warnings, ...b.warnings],
    validation: { rules_passed: [], rules_failed: [] },
    status: "ok",
    stats: { backend: a.stats?.backend ?? "mock", critical_confidence: Math.max(a.stats?.critical_confidence ?? 0, b.stats?.critical_confidence ?? 0) },
  };
  const keys = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)]);
  for (const k of keys) {
    const fa = a.fields[k];
    const fb = b.fields[k];
    if (fa && fb) {
      out.fields[k] = fa.confidence >= fb.confidence ? fa : fb;
    } else {
      out.fields[k] = (fa ?? fb)!;
    }
  }
  return out;
}
