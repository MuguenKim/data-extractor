"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callOllamaLangExtract = callOllamaLangExtract;
// Placeholder for Ollama API call. In restricted environments this should not be invoked.
async function callOllamaLangExtract({ schema, chunk, model, host }) {
    if (!host) {
        throw new Error("OLLAMA_HOST missing; cannot call Ollama backend");
    }
    throw new Error("Ollama backend not available in this environment");
}
