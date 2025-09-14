import { DocumentText, IngestOptions } from './types';

export function ingestDOCX(_buf: Buffer, opts: IngestOptions): DocumentText {
  // Placeholder: DOCX requires ZIP read (word/document.xml). Defer to worker (python-docx) or add zip lib.
  const warnings = ['DOCX parsing not implemented in dev; route to worker (python-docx) or convert to TXT.'];
  return {
    text: '',
    pageMap: [{ page: 1, start: 0, end: 0 }],
    warnings,
    meta: { adapter: 'docx', mime: opts.mime, filename: opts.filename, bytes: 0 }
  };
}

export function ingestDOC(_buf: Buffer, opts: IngestOptions): DocumentText {
  // Legacy .doc (OLE). Placeholder only.
  const warnings = ['DOC parsing not implemented in dev; route to soffice/antiword or convert to DOCX/TXT.'];
  return {
    text: '',
    pageMap: [{ page: 1, start: 0, end: 0 }],
    warnings,
    meta: { adapter: 'doc', mime: opts.mime, filename: opts.filename, bytes: 0 }
  };
}

export async function ingestDOCXAsync(buf: Buffer, opts: IngestOptions): Promise<DocumentText> {
  const mammoth = await import('mammoth');
  const result = await (mammoth as any).extractRawText({ buffer: buf });
  const text: string = result?.value || '';
  return {
    text,
    pageMap: [{ page: 1, start: 0, end: text.length }],
    warnings: [],
    meta: { adapter: 'docx', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
  };
}
