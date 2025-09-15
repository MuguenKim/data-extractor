import { DocumentText, IngestOptions } from './types';

export function ingestPDF(buf: Buffer, opts: IngestOptions): DocumentText {
  // Placeholder: real PDF text extraction is done via pdfjs-dist (web/worker)
  // and OCR for image-only. Here we acknowledge PDF and return empty text + warning.
  const isPDF = buf.slice(0, 4).toString('ascii') === '%PDF';
  const warnings = [
    isPDF ? 'PDF detected; text extraction not implemented in dev adapter. Use web/worker path with pdfjs-dist. Fallback to OCR for scanned PDFs.'
          : 'Input not recognized as PDF header; skipping.'
  ];
  return {
    text: '',
    pageMap: [{ page: 1, start: 0, end: 0 }],
    warnings,
    meta: { adapter: 'pdf', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
  };
}

export async function ingestPDFAsync(buf: Buffer, opts: IngestOptions): Promise<DocumentText> {
  const pdfjs = await import('pdfjs-dist');
  // @ts-ignore
  const getDocument = (pdfjs as any).getDocument || (pdfjs as any).default?.getDocument;
  if (!getDocument) {
    return ingestPDF(buf, opts);
  }
  const data = (typeof Buffer !== 'undefined' && Buffer.isBuffer(buf))
    ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    : (buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const loadingTask = getDocument({ data });
  const doc = await loadingTask.promise;
  const numPages = doc.numPages || 1;
  let text = '';
  const pageMap: { page: number; start: number; end: number }[] = [];
  for (let p = 1; p <= numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => it.str).filter(Boolean);
    const pageText = strings.join('\n');
    const start = text.length;
    text += (p > 1 ? '\n\n' : '') + pageText;
    const end = text.length;
    pageMap.push({ page: p, start, end });
  }
  if (!text.trim()) {
    return {
      text: '',
      pageMap: [{ page: 1, start: 0, end: 0 }],
      warnings: ['No selectable text found; OCR fallback not wired in dev.'],
      meta: { adapter: 'pdf', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
    };
  }
  return {
    text,
    pageMap,
    warnings: [],
    meta: { adapter: 'pdf', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
  };
}
