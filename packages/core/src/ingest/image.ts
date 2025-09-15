import { DocumentText, IngestOptions } from './types';

export function ingestImage(buf: Buffer, opts: IngestOptions): DocumentText {
  // Sync fallback: no OCR in dev without async libs.
  const warnings = ['Image OCR not implemented in dev adapter; needs worker OCR.'];
  return {
    text: '',
    pageMap: [{ page: 1, start: 0, end: 0 }],
    warnings,
    bboxMap: {},
    meta: { adapter: 'image', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
  };
}

export async function ingestImageAsync(buf: Buffer, opts: IngestOptions): Promise<DocumentText> {
  // Try to OCR with tesseract.js if available locally. Fallback to sync placeholder.
  let Tesseract: any;
  try {
    Tesseract = await import('tesseract.js');
  } catch (e: any) {
    const base = ingestImage(buf, opts);
    base.warnings = (base.warnings || []).concat(`OCR disabled: tesseract.js not found (${e?.message || 'module_resolve_failed'})`);
    return base;
  }
  const binary = (typeof Buffer !== 'undefined' && Buffer.isBuffer(buf))
    ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    : (buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const langMap: Record<string, string> = { english: 'eng', french: 'fra', german: 'deu', spanish: 'spa', italian: 'ita', arabic: 'ara', russian: 'rus' };
  const hinted = (opts.languageHint || '').toLowerCase();
  const lang = process.env.OCR_LANG || (langMap[hinted] || hinted) || 'eng';
  const langPath = process.env.OCR_LANG_PATH; // optional local traineddata dir
  try {
    // Prefer worker API to control langPath; fallback to direct recognize.
    let data: any;
    try {
      const createWorker = (Tesseract as any).createWorker;
      if (typeof createWorker === 'function') {
        const langs = (lang || 'eng').trim().replace(/[\s,]+/g, '+');
        const worker = await createWorker(langs, undefined, {
          langPath: langPath || undefined,
          gzip: true,
        } as any);
        const result = await worker.recognize(binary);
        data = result?.data;
        await worker.terminate();
      } else {
        throw new Error('no_worker');
      }
    } catch (_e) {
      const result = await (Tesseract as any).recognize(binary, lang, { langPath: langPath || undefined });
      data = result?.data;
    }
    const fullText: string = (data?.text || '').replace(/\r\n/g, '\n');
    const pageMap = [{ page: 1, start: 0, end: fullText.length }];

    // Map words to token spans by scanning forward through fullText
    const tokens: Array<{ text: string; start: number; end: number; bbox: [number, number, number, number] }> = [];
    let cursor = 0;
    const words = Array.isArray(data?.words) ? data.words : [];
    for (const w of words) {
      const text = (w?.text || '').toString();
      if (!text) continue;
      let start = fullText.indexOf(text, cursor);
      if (start === -1) {
        // Try a trimmed match
        const trimmed = text.trim();
        if (trimmed) start = fullText.indexOf(trimmed, cursor);
      }
      if (start === -1) {
        // Best-effort fallback: place at cursor
        start = cursor;
      }
      const end = Math.min(start + text.length, fullText.length);
      cursor = end;
      const bb = w?.bbox || w?.bbox?.[0] ? w.bbox : { x0: w?.x0 ?? w?.x ?? 0, y0: w?.y0 ?? 0, x1: (w?.x1 ?? 0), y1: (w?.y1 ?? 0) };
      const bbox: [number, number, number, number] = [
        Number(bb?.x0 ?? 0),
        Number(bb?.y0 ?? 0),
        Number(bb?.x1 ?? 0),
        Number(bb?.y1 ?? 0)
      ];
      tokens.push({ text, start, end, bbox });
    }

    const bboxMap: DocumentText['bboxMap'] = {
      1: { tokens }
    } as any;

    const warnings: string[] = [];
    if (!fullText.trim()) {
      warnings.push('OCR produced no text; image may be unreadable.');
    }

    return {
      text: fullText,
      pageMap,
      warnings,
      bboxMap,
      meta: { adapter: 'image', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
    };
  } catch (err: any) {
    const base = ingestImage(buf, opts);
    base.warnings = (base.warnings || []).concat(`OCR attempt failed: ${err?.message || String(err)}`);
    return base;
  }
}
