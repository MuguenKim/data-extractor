"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkText = chunkText;
// naive token estimator: ~4 chars per token
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
function chunkText(text, opts = {}) {
    const maxTokens = opts.maxTokens ?? 3000;
    const overlapPct = opts.overlapPct ?? 0.12;
    if (!text)
        return [];
    const totalTokens = estimateTokens(text);
    if (totalTokens <= maxTokens) {
        return [
            { id: "0", start: 0, end: text.length, text },
        ];
    }
    const approxChunkChars = maxTokens * 4; // inverse of estimator
    const overlapChars = Math.floor(approxChunkChars * overlapPct);
    const chunks = [];
    let start = 0;
    let idx = 0;
    while (start < text.length) {
        const end = Math.min(start + approxChunkChars, text.length);
        const chunkText = text.slice(start, end);
        chunks.push({ id: String(idx++), start, end, text: chunkText });
        if (end === text.length)
            break;
        start = end - overlapChars; // step with overlap
    }
    return chunks;
}
