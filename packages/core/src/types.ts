export type Backend = "groq" | "ollama" | "mock";

export interface SpanChar {
  page?: number | null;
  start: number; // inclusive char offset in original text
  end: number; // exclusive char offset
  bbox?: { x: number; y: number; w: number; h: number };
}

export interface FieldResult<T = any> {
  value: T | null;
  confidence: number; // 0..1
  spans: SpanChar[];
  warnings?: string[];
  meta?: Record<string, any>;
}

export interface ResultEnvelope {
  fields: Record<string, FieldResult>;
  warnings: string[];
  validation: {
    rules_passed: string[];
    rules_failed: string[];
  };
  status: "ok" | "needs_review" | "failed";
  stats?: {
    critical_confidence: number;
    backend: Backend;
    model?: string;
    pages?: number;
    tokens_estimated?: number;
  };
}

export interface SchemaField {
  name: string;
  type: "string" | "number" | "integer" | "boolean" | "object" | "array" | "date";
  description?: string;
  pattern?: string;
  enum?: string[];
  required?: boolean;
  critical?: boolean; // for routing/escalation
  label_hints?: string[]; // for label-led extraction
  format?: string; // date, currency, etc.
}

export interface WorkflowSchema {
  id: string;
  title?: string;
  fields: SchemaField[];
}

export interface ExtractionChunk {
  id: string;
  start: number; // start char offset in full text
  end: number; // end char offset in full text (exclusive)
  text: string;
}

export interface ExtractWithLangExtractArgs {
  schema: WorkflowSchema;
  text: string;
  chunks?: ExtractionChunk[];
  backend: Backend | "auto";
  modelHints?: { groq?: string; ollama?: string };
}

export interface WorkflowConfig {
  id: string;
  schema: WorkflowSchema;
  backend: Backend | "auto";
  ocr_policy?: "auto" | "doctr" | "rapidocr" | "tesseract" | "none";
  lang_hint?: string;
}

export interface ValidationRule {
  expr: string; // DSL expression, e.g., equals(add(a,b), c)
  critical?: boolean;
}

