"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extract_with_langextract = extract_with_langextract;
const chunker_1 = require("./chunker");
const merge_1 = require("./merge");
const router_1 = require("./router");
async function extract_with_langextract(args) {
    const chunks = args.chunks && args.chunks.length > 0 ? args.chunks : (0, chunker_1.chunkText)(args.text);
    const perChunk = [];
    let usedBackend = "mock";
    let usedModel = undefined;
    // First pass
    for (const chunk of chunks) {
        const { result, backend, model } = await (0, router_1.extractViaBackend)({
            backend: args.backend,
            schema: args.schema,
            chunk,
            modelHints: args.modelHints,
        });
        usedBackend = backend;
        usedModel = model;
        perChunk.push(result);
    }
    let merged = (0, merge_1.mergeResults)({ perChunk, schemaFields: args.schema.fields });
    merged.stats = merged.stats || {};
    merged.stats.backend = usedBackend;
    if (usedModel)
        merged.stats.model = usedModel;
    // Escalation: if critical_confidence < threshold, try Groq precision pass
    const threshold = Number(process.env.CONFIDENCE_THRESHOLD_CRITICAL ?? "0.9");
    const needsEscalation = merged.stats?.critical_confidence !== undefined && merged.stats.critical_confidence < threshold;
    const defaultBackend = process.env.DEFAULT_BACKEND ?? "groq";
    if (needsEscalation && defaultBackend !== "groq") {
        const perChunkGroq = [];
        for (const chunk of chunks) {
            const { result } = await (0, router_1.extractViaBackend)({ backend: "groq", schema: args.schema, chunk, modelHints: args.modelHints });
            perChunkGroq.push(result);
        }
        const mergedGroq = (0, merge_1.mergeResults)({ perChunk: perChunkGroq, schemaFields: args.schema.fields });
        merged = pickHigherConfidence(merged, mergedGroq);
        merged.stats = merged.stats || {};
        merged.stats.backend = "groq";
    }
    return merged;
}
function pickHigherConfidence(a, b) {
    const out = {
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
        }
        else {
            out.fields[k] = (fa ?? fb);
        }
    }
    return out;
}
