"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestImageAsync = exports.ingestImage = void 0;

function ingestImage(buf, opts) {
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
exports.ingestImage = ingestImage;

async function ingestImageAsync(buf, opts) {
    // Try to OCR with tesseract.js if available locally. Fallback to sync placeholder.
    let Tesseract;
    try {
        Tesseract = await import('tesseract.js');
    }
    catch (e) {
        const base = ingestImage(buf, opts);
        base.warnings = (base.warnings || []).concat(`OCR disabled: tesseract.js not found (${(e === null || e === void 0 ? void 0 : e.message) || 'module_resolve_failed'})`);
        return base;
    }
    const langMap = { english: 'eng', french: 'fra', german: 'deu', spanish: 'spa', italian: 'ita', arabic: 'ara', russian: 'rus' };
    const hinted = (opts.languageHint || '').toLowerCase();
    const lang = process.env.OCR_LANG || (langMap[hinted] || hinted) || 'eng';
    const langPath = process.env.OCR_LANG_PATH; // optional local traineddata dir
    try {
        // Prefer worker API to control langPath; fallback to direct recognize.
        let data;
        try {
            const createWorker = Tesseract.createWorker;
            if (typeof createWorker === 'function') {
                const langs = (lang || 'eng').trim().replace(/[\s,]+/g, '+');
                const worker = await createWorker(langs, undefined, {
                    langPath: langPath || undefined,
                    gzip: true,
                });
                const result = await worker.recognize(buf);
                data = result === null || result === void 0 ? void 0 : result.data;
                await worker.terminate();
            }
            else {
                throw new Error('no_worker');
            }
        }
        catch (_e) {
            const result = await Tesseract.recognize(buf, lang, { langPath: langPath || undefined });
            data = result === null || result === void 0 ? void 0 : result.data;
        }
        const fullText = ((data === null || data === void 0 ? void 0 : data.text) || '').replace(/\r\n/g, '\n');
        const pageMap = [{ page: 1, start: 0, end: fullText.length }];
        // Map words to token spans by scanning forward through fullText
        const tokens = [];
        let cursor = 0;
        const words = Array.isArray(data === null || data === void 0 ? void 0 : data.words) ? data.words : [];
        for (const w of words) {
            const text = (w === null || w === void 0 ? void 0 : w.text) || '';
            if (!text)
                continue;
            let start = fullText.indexOf(text, cursor);
            if (start === -1) {
                const trimmed = text.trim();
                if (trimmed)
                    start = fullText.indexOf(trimmed, cursor);
            }
            if (start === -1) {
                // Best-effort fallback: place at cursor
                start = cursor;
            }
            const end = Math.min(start + text.length, fullText.length);
            cursor = end;
            const bb = (w === null || w === void 0 ? void 0 : w.bbox) || ((w === null || w === void 0 ? void 0 : w.bbox) && (w === null || w === void 0 ? void 0 : w.bbox[0])) ? w.bbox : { x0: (w === null || w === void 0 ? void 0 : w.x0) !== null && (w === null || w === void 0 ? void 0 : w.x0) !== void 0 ? w === null || w === void 0 ? void 0 : w.x0 : (w === null || w === void 0 ? void 0 : w.x) || 0, y0: (w === null || w === void 0 ? void 0 : w.y0) || 0, x1: (w === null || w === void 0 ? void 0 : w.x1) || 0, y1: (w === null || w === void 0 ? void 0 : w.y1) || 0 };
            const bbox = [
                Number((bb === null || bb === void 0 ? void 0 : bb.x0) || 0),
                Number((bb === null || bb === void 0 ? void 0 : bb.y0) || 0),
                Number((bb === null || bb === void 0 ? void 0 : bb.x1) || 0),
                Number((bb === null || bb === void 0 ? void 0 : bb.y1) || 0)
            ];
            tokens.push({ text, start, end, bbox });
        }
        const bboxMap = {
            1: { tokens }
        };
        const warnings = [];
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
    }
    catch (err) {
        const base = ingestImage(buf, opts);
        base.warnings = (base.warnings || []).concat(`OCR attempt failed: ${(err === null || err === void 0 ? void 0 : err.message) || String(err)}`);
        return base;
    }
}
exports.ingestImageAsync = ingestImageAsync;
