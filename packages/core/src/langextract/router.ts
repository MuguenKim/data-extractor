import { Backend, ExtractionChunk, ResultEnvelope, WorkflowSchema } from "../types";
import { callGroqLangExtract } from "./backends/groq";
import { callOllamaLangExtract } from "./backends/ollama";
import { extractLocal } from "./local";

export interface RouteArgs {
  backend: Backend | "auto";
  schema: WorkflowSchema;
  chunk: ExtractionChunk;
  modelHints?: { groq?: string; ollama?: string };
}

export async function extractViaBackend(
  args: RouteArgs
): Promise<{ result: ResultEnvelope; backend: Backend; model?: string }> {
  const env = process.env;
  const defaultBackend = (env.DEFAULT_BACKEND as Backend | undefined) ?? "groq";
  const selected = args.backend === "auto" ? defaultBackend : args.backend;

  if (selected === "mock") {
    const result = await extractLocal(args.schema, args.chunk);
    return { result, backend: "mock" };
  }

  if (selected === "ollama") {
    const model = args.modelHints?.ollama ?? env.DEFAULT_MODEL_OLLAMA ?? "llama3.1:8b-instruct";
    const host = env.OLLAMA_HOST;
    const result = await callOllamaLangExtract({ schema: args.schema, chunk: args.chunk, model, host });
    return { result, backend: "ollama", model };
  }

  // groq
  const model = args.modelHints?.groq ?? env.DEFAULT_MODEL_GROQ ?? "llama-3.1-70b-versatile";
  const apiKey = env.GROQ_API_KEY;
  const result = await callGroqLangExtract({ schema: args.schema, chunk: args.chunk, model, apiKey });
  return { result, backend: "groq", model };
}

