"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callGroqLangExtract = callGroqLangExtract;
// Placeholder for Groq API call. In restricted environments this should not be invoked.
async function callGroqLangExtract({ schema, chunk, model, apiKey }) {
    if (!apiKey) {
        throw new Error("GROQ_API_KEY missing; cannot call Groq backend");
    }
    // Non-functional stub: a real implementation would construct a strict prompt
    // and call Groq's completion API, then parse controlled JSON.
    // Here we throw to avoid accidental network use in restricted environments.
    throw new Error("Groq backend not available in this environment");
}
