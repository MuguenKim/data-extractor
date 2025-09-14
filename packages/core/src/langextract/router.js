"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractViaBackend = extractViaBackend;
const groq_1 = require("./backends/groq");
const ollama_1 = require("./backends/ollama");
async function extractViaBackend(args) {
    const env = process.env;
    const defaultBackend = env.DEFAULT_BACKEND ?? "groq";
    const selected = args.backend === "auto" ? defaultBackend : args.backend;
    if (selected === "ollama") {
        const model = args.modelHints?.ollama ?? env.DEFAULT_MODEL_OLLAMA ?? "llama3.1:8b-instruct";
        const host = env.OLLAMA_HOST;
        const result = await (0, ollama_1.callOllamaLangExtract)({ schema: args.schema, chunk: args.chunk, model, host });
        return { result, backend: "ollama", model };
    }
    // groq
    const model = args.modelHints?.groq ?? env.DEFAULT_MODEL_GROQ ?? "llama-3.1-70b-versatile";
    const apiKey = env.GROQ_API_KEY;
    const result = await (0, groq_1.callGroqLangExtract)({ schema: args.schema, chunk: args.chunk, model, apiKey });
    return { result, backend: "groq", model };
}
