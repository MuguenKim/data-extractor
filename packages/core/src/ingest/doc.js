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
exports.ingestDOCX = ingestDOCX;
exports.ingestDOC = ingestDOC;
exports.ingestDOCXAsync = ingestDOCXAsync;
function ingestDOCX(_buf, opts) {
    // Placeholder: DOCX requires ZIP read (word/document.xml). Defer to worker (python-docx) or add zip lib.
    const warnings = ['DOCX parsing not implemented in dev; route to worker (python-docx) or convert to TXT.'];
    return {
        text: '',
        pageMap: [{ page: 1, start: 0, end: 0 }],
        warnings,
        meta: { adapter: 'docx', mime: opts.mime, filename: opts.filename, bytes: 0 }
    };
}
function ingestDOC(_buf, opts) {
    // Legacy .doc (OLE). Placeholder only.
    const warnings = ['DOC parsing not implemented in dev; route to soffice/antiword or convert to DOCX/TXT.'];
    return {
        text: '',
        pageMap: [{ page: 1, start: 0, end: 0 }],
        warnings,
        meta: { adapter: 'doc', mime: opts.mime, filename: opts.filename, bytes: 0 }
    };
}
async function ingestDOCXAsync(buf, opts) {
    const mammoth = await Promise.resolve().then(() => __importStar(require('mammoth')));
    const result = await mammoth.extractRawText({ buffer: buf });
    const text = result?.value || '';
    return {
        text,
        pageMap: [{ page: 1, start: 0, end: text.length }],
        warnings: [],
        meta: { adapter: 'docx', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
    };
}
