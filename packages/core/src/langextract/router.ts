import { Backend, ExtractionChunk, ResultEnvelope, WorkflowSchema } from "../types";
import { callGroqLangExtract } from "./backends/groq";
import { callOllamaLangExtract } from "./backends/ollama";
import { getLogger } from "../logger";

export interface RouteArgs {
  backend: Backend | "auto";
  schema: WorkflowSchema;
  chunk: ExtractionChunk;
  modelHints?: { groq?: string; ollama?: string };
}

export async function extractViaBackend(
  args: RouteArgs
): Promise<{ result: ResultEnvelope; backend: Backend; model?: string }> {
  const log = getLogger('core').child({});
  const env = process.env;
  // Prefer Groq when API key is present; only fall back in 'auto' mode
  const defaultBackend: Backend = ((env.DEFAULT_BACKEND as Backend | undefined)
    ?? (env.GROQ_API_KEY ? "groq" : "ollama"));
  let selected: Backend = (args.backend === "auto" ? defaultBackend : args.backend) as Backend;

  if (selected === "ollama") {
    const model = args.modelHints?.ollama ?? env.DEFAULT_MODEL_OLLAMA ?? "llama3.1:8b-instruct";
    const host = env.OLLAMA_HOST;
    log.info('backend.ollama.call', { model, has_host: !!host, chunk_id: args.chunk.id });
    const result = await callOllamaLangExtract({ schema: args.schema, chunk: args.chunk, model, host });
    return { result, backend: "ollama", model };
  }

  // groq
  const model = args.modelHints?.groq ?? env.DEFAULT_MODEL_GROQ ?? "llama-3.1-70b-versatile";
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) {
    if (args.backend !== "auto") {
      // Explicitly requested Groq — do not silently fall back
      log.warn('backend.groq.key_missing', { chunk_id: args.chunk.id });
      throw new Error("GROQ_API_KEY missing; cannot call Groq backend");
    }
    // In auto mode, fall back to Ollama if available
    const ollamaModel = args.modelHints?.ollama ?? env.DEFAULT_MODEL_OLLAMA ?? "llama3.1:8b-instruct";
    const host = env.OLLAMA_HOST;
    log.info('backend.ollama.fallback', { model: ollamaModel, has_host: !!host, chunk_id: args.chunk.id });
    const result = await callOllamaLangExtract({ schema: args.schema, chunk: args.chunk, model: ollamaModel, host });
    return { result, backend: "ollama", model: ollamaModel };
  }
  log.info('backend.groq.call', { model, has_api_key: !!apiKey, chunk_id: args.chunk.id });
  const result = await callGroqLangExtract({ schema: args.schema, chunk: args.chunk, model, apiKey });
  return { result, backend: "groq", model };
}

