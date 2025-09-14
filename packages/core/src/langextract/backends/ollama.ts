import { ResultEnvelope, WorkflowSchema, ExtractionChunk } from "../../types";

interface CallArgs {
  schema: WorkflowSchema;
  chunk: ExtractionChunk;
  model: string;
  host?: string;
}

// Placeholder for Ollama API call. In restricted environments this should not be invoked.
export async function callOllamaLangExtract({ schema, chunk, model, host }: CallArgs): Promise<ResultEnvelope> {
  if (!host) {
    throw new Error("OLLAMA_HOST missing; cannot call Ollama backend");
  }
  throw new Error("Ollama backend not available in this environment");
}

