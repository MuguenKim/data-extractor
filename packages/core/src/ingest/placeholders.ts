import { DocumentText, IngestOptions } from './types';

export function ingestPlaceholder(buf: Buffer, opts: IngestOptions, kind: string, note?: string): DocumentText {
  const warnings: string[] = [note || `${kind} adapter not implemented; returning empty text.`];
  return {
    text: '',
    pageMap: [{ page: 1, start: 0, end: 0 }],
    warnings,
    meta: { adapter: kind, mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
  };
}

