"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestPDF = ingestPDF;
exports.ingestPDFAsync = ingestPDFAsync;
function ingestPDF(buf, opts) {
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
async function ingestPDFAsync(buf, opts) {
    const pdfjs = await Promise.resolve().then(() => __importStar(require('pdfjs-dist')));
    // @ts-ignore
    const getDocument = pdfjs.getDocument || pdfjs.default?.getDocument;
    if (!getDocument) {
        return ingestPDF(buf, opts);
    }
    const loadingTask = getDocument({ data: buf });
    const doc = await loadingTask.promise;
    const numPages = doc.numPages || 1;
    let text = '';
    const pageMap = [];
    for (let p = 1; p <= numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const strings = content.items.map((it) => it.str).filter(Boolean);
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
