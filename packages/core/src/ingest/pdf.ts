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

type PdfTextItem = {
  str: string;
  transform: [number, number, number, number, number, number];
  width?: number;
  height?: number;
};

function clusterItemsIntoLines(items: PdfTextItem[]) {
  const lineTolerance = 3; // points
  const lines: Array<{ y: number; items: Array<PdfTextItem & { x: number; y: number }> }> = [];
  for (const raw of items) {
    if (!raw?.str) continue;
    const [,, , , e, f] = raw.transform;
    const x = Number(e || 0);
    const y = Number(f || 0);
    let line = lines.find((ln) => Math.abs(ln.y - y) <= lineTolerance);
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    }
    line.items.push({ ...raw, x, y });
  }

  // Sort top-to-bottom (PDF origin bottom-left)
  lines.sort((a, b) => b.y - a.y);

  return lines;
}

type PageExtraction = {
  text: string;
  tokens: Array<{ text: string; start: number; end: number; bbox: [number, number, number, number] }>;
};

// Reconstruct lines using PDF text geometry so tables keep column gaps that downstream
// heuristics can detect (tabs for wide jumps, spaces for smaller intra-word gaps).
function extractPageText(pageLines: ReturnType<typeof clusterItemsIntoLines>, viewportHeight: number): PageExtraction {
  const defaultWordGap = 2.5;
  const defaultColumnGap = 12;
  let buffer = '';
  const tokens: PageExtraction['tokens'] = [];

  for (const line of pageLines) {
    if (buffer.length && !buffer.endsWith('\n')) buffer += '\n';
    let prevRight: number | null = null;
    const sorted = line.items.slice().sort((a, b) => a.x - b.x);
    let totalWidth = 0;
    let totalChars = 0;
    for (const item of sorted) {
      if (!item?.str) continue;
      const normalized = item.str.replace(/[\u00A0]/g, ' ');
      const rawWidth = Number(item.width ?? Math.abs(item.transform?.[0] || 0));
      const approxWidth = rawWidth || normalized.length * 4;
      totalWidth += approxWidth;
      totalChars += normalized.replace(/\s+/g, '').length || normalized.length;
    }
    const avgCharWidth = totalChars ? totalWidth / totalChars : 0;
    const wordGapThreshold = Math.max(defaultWordGap, avgCharWidth * 0.6);
    const columnGapThreshold = Math.max(defaultColumnGap, avgCharWidth * 3.5);
    for (const item of sorted) {
      const rawText = item.str || '';
      if (!rawText) continue;
      const text = rawText.replace(/[\u00A0]/g, ' ');
      const rawWidth = Number(item.width ?? Math.abs(item.transform?.[0] || 0));
      const approxWidth = rawWidth || text.length * 4;
      const height = Number(item.height ?? Math.abs(item.transform?.[3] || 0));
      const left = item.x;
      const baseline = item.y;
      if (prevRight !== null) {
        const gap = left - prevRight;
        if (gap > columnGapThreshold) {
          buffer += '\t';
        } else if (gap > wordGapThreshold) {
          buffer += ' ';
        }
      }
      const start = buffer.length;
      buffer += text;
      const end = buffer.length;
      const top = viewportHeight - baseline;
      const bottom = top - (height || 0);
      const bbox: [number, number, number, number] = [
        Number(left),
        Number(bottom),
        Number(left + approxWidth),
        Number(top)
      ];
      tokens.push({ text, start, end, bbox });
      prevRight = left + approxWidth;
    }
  }

  return { text: buffer, tokens };
}

export async function ingestPDFAsync(buf: Buffer, opts: IngestOptions): Promise<DocumentText> {
  const pdfjs = await import('pdfjs-dist');
  // @ts-ignore pdfjs-dist ships both default and named exports depending on bundler
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
  const bboxMap: NonNullable<DocumentText['bboxMap']> = {};

  for (let p = 1; p <= numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent({ disableCombineTextItems: false });
    const lines = clusterItemsIntoLines(content.items as PdfTextItem[]);
    const { text: pageText, tokens } = extractPageText(lines, viewport.height);
    if (p > 1 && text.length) {
      text += '\n\n';
    }
    const start = text.length;
    const normalized = pageText.replace(/[\u00A0]/g, ' ');
    text += normalized;
    const end = text.length;
    pageMap.push({ page: p, start, end });
    bboxMap[p] = {
      tokens: tokens.map((tok) => ({
        text: tok.text,
        start: tok.start + start,
        end: tok.end + start,
        bbox: tok.bbox,
      }))
    };
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
    bboxMap,
    meta: { adapter: 'pdf', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
  };
}
