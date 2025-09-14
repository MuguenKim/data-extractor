import { ResultEnvelope, WorkflowSchema, ExtractionChunk } from "../../types";

interface CallArgs {
  schema: WorkflowSchema;
  chunk: ExtractionChunk;
  model: string;
  apiKey?: string;
}

// Placeholder for Groq API call. In restricted environments this should not be invoked.
export async function callGroqLangExtract({ schema, chunk, model, apiKey }: CallArgs): Promise<ResultEnvelope> {
  if (!apiKey) {
    throw new Error("GROQ_API_KEY missing; cannot call Groq backend");
  }
  // Non-functional stub: a real implementation would construct a strict prompt
  // and call Groq's completion API, then parse controlled JSON.
  // Here we throw to avoid accidental network use in restricted environments.
  throw new Error("Groq backend not available in this environment");
}

