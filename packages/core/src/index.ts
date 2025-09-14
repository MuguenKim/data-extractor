export * from "./types";
export * from "./langextract/index";
export * from "./validation/dsl";
export * from "./ingest/index";
export { getLogger } from "./logger";

// Back-compat type aliases for existing internal extractors
export type ExtractionResult = import('./types').ResultEnvelope;
export type Span = import('./types').SpanChar;

// Schemas
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON module
export { default as invoiceSchemaV1 } from "./schemas/invoice.v1.json";
