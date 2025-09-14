export type PageSpan = {
  page: number;
  start: number; // inclusive char offset in full text
  end: number;   // exclusive char offset
};

export type DocumentText = {
  text: string;
  pageMap: PageSpan[];
  language?: string;
  warnings?: string[];
  // Optional OCR bbox map per token/line when available
  bboxMap?: {
    // For each page, arrays of tokens and lines with char offsets and bboxes
    [page: number]: {
      tokens?: Array<{ text: string; start: number; end: number; bbox: [number, number, number, number] }>;
      lines?: Array<{ text: string; start: number; end: number; bbox: [number, number, number, number] }>;
    };
  };
  meta?: {
    adapter: string;
    mime?: string;
    filename?: string;
    bytes?: number;
    // Adapter-specific notes (e.g., sheet names, parts list)
    notes?: string[];
  };
};

export type IngestOptions = {
  languageHint?: string;
  // Deprecated/no-op: PII is never masked during ingest; content is preserved.
  maskPII?: boolean;
  mime?: string;
  filename?: string;
};
