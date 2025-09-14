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
exports.guessAdapter = guessAdapter;
exports.ingestFromText = ingestFromText;
exports.ingestBuffer = ingestBuffer;
exports.ingestBufferAsync = ingestBufferAsync;
const html_1 = require("./html");
const text_1 = require("./text");
const csv_1 = require("./csv");
const pii_1 = require("../pii");
const lang_1 = require("../lang");
const email_1 = require("./email");
const spreadsheet_1 = require("./spreadsheet");
const pdf_1 = require("./pdf");
const doc_1 = require("./doc");
const image_1 = require("./image");
const presentation_1 = require("./presentation");
function guessAdapter(filename, mime) {
    const ext = (filename || '').toLowerCase();
    const m = (mime || '').toLowerCase();
    if (m.includes('text/html') || ext.endsWith('.html') || ext.endsWith('.htm'))
        return 'html';
    if (m.includes('multipart/related') || ext.endsWith('.mhtml') || ext.endsWith('.mht'))
        return 'mhtml';
    if (m.includes('message/rfc822') || ext.endsWith('.eml'))
        return 'eml';
    if (ext.endsWith('.msg'))
        return 'msg';
    if (m.includes('text/csv') || ext.endsWith('.csv'))
        return 'csv';
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.ods'))
        return 'spreadsheet';
    if (m.includes('text/plain') || ext.endsWith('.txt') || ext.endsWith('.log'))
        return 'text';
    if (ext.endsWith('.pdf') || m.includes('application/pdf'))
        return 'pdf';
    if (ext.endsWith('.docx'))
        return 'docx';
    if (ext.endsWith('.doc') || m.includes('application/msword'))
        return 'doc';
    if (ext.endsWith('.pptx') || ext.endsWith('.odp') || m.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation'))
        return 'presentation';
    if (m.startsWith('image/') || /(png|jpg|jpeg|tif|tiff|bmp|gif|webp|heic)$/i.test(ext))
        return 'image';
    return 'text';
}
function ingestFromText(text, opts = {}) {
    const pageMap = [{ page: 1, start: 0, end: text.length }];
    return { text, pageMap, warnings: [], meta: { adapter: 'text', mime: opts.mime, filename: opts.filename, bytes: Buffer.byteLength(text) } };
}
function ingestBuffer(buf, opts = {}) {
    const adapter = guessAdapter(opts.filename, opts.mime);
    let doc;
    switch (adapter) {
        case 'html':
            doc = (0, html_1.ingestHTML)(buf, opts);
            break;
        case 'mhtml':
            doc = (0, email_1.ingestMHTML)(buf, opts);
            break;
        case 'eml':
            doc = (0, email_1.ingestEML)(buf, opts);
            break;
        case 'msg':
            // Sync path uses placeholder/basic MSG; async variant available in ingestBufferAsync
            doc = (0, email_1.ingestMSG)(buf, opts);
            break;
        case 'csv':
            doc = (0, csv_1.ingestCSV)(buf, opts);
            break;
        case 'spreadsheet':
            doc = (0, spreadsheet_1.ingestSpreadsheet)(buf, opts);
            break;
        case 'text':
            doc = (0, text_1.ingestPlainText)(buf, opts);
            break;
        case 'pdf':
            doc = (0, pdf_1.ingestPDF)(buf, opts);
            break;
        case 'docx':
            doc = (0, doc_1.ingestDOCX)(buf, opts);
            break;
        case 'doc':
            doc = (0, doc_1.ingestDOC)(buf, opts);
            break;
        case 'presentation':
            doc = (0, presentation_1.ingestPresentation)(buf, opts);
            break;
        case 'image':
            // Sync path cannot await; use basic image ingest (no OCR)
            doc = (0, image_1.ingestImage)(buf, opts);
            break;
        default:
            doc = (0, text_1.ingestPlainText)(buf, opts);
    }
    // Language hint
    const lang = opts.languageHint || (0, lang_1.detectLanguage)(doc.text || '');
    doc.language = lang;
    // PII mask at storage boundary (default true)
    const doMask = opts.maskPII !== false;
    if (doMask && doc.text) {
        doc.text = (0, pii_1.maskPII)(doc.text);
    }
    return doc;
}
// Async variant for adapters that require async libs (pdfjs, mammoth, unzipper)
async function ingestBufferAsync(buf, opts = {}) {
    const adapter = guessAdapter(opts.filename, opts.mime);
    let doc;
    switch (adapter) {
        case 'html':
            doc = (0, html_1.ingestHTML)(buf, opts);
            break;
        case 'mhtml':
            doc = (0, email_1.ingestMHTML)(buf, opts);
            break;
        case 'eml':
            doc = (0, email_1.ingestEML)(buf, opts);
            break;
        case 'msg':
            doc = await Promise.resolve().then(() => __importStar(require('./email'))).then(m => m.ingestMSGAsync ? m.ingestMSGAsync(buf, opts) : m.ingestMSG(buf, opts));
            break;
        case 'csv':
            doc = (0, csv_1.ingestCSV)(buf, opts);
            break;
        case 'spreadsheet':
            doc = (0, spreadsheet_1.ingestSpreadsheet)(buf, opts);
            break;
        case 'text':
            doc = (0, text_1.ingestPlainText)(buf, opts);
            break;
        case 'pdf':
            doc = await Promise.resolve().then(() => __importStar(require('./pdf'))).then(m => m.ingestPDFAsync ? m.ingestPDFAsync(buf, opts) : m.ingestPDF(buf, opts));
            break;
        case 'docx':
            doc = await Promise.resolve().then(() => __importStar(require('./doc'))).then(m => m.ingestDOCXAsync ? m.ingestDOCXAsync(buf, opts) : m.ingestDOCX(buf, opts));
            break;
        case 'doc':
            doc = (0, doc_1.ingestDOC)(buf, opts);
            break;
        case 'presentation':
            doc = await Promise.resolve().then(() => __importStar(require('./presentation'))).then(m => m.ingestPresentationAsync ? m.ingestPresentationAsync(buf, opts) : m.ingestPresentation(buf, opts));
            break;
        case 'image':
            doc = await Promise.resolve().then(() => __importStar(require('./image'))).then(m => m.ingestImageAsync ? m.ingestImageAsync(buf, opts) : m.ingestImage(buf, opts));
            break;
        default:
            doc = (0, text_1.ingestPlainText)(buf, opts);
    }
    const lang = opts.languageHint || (0, lang_1.detectLanguage)(doc.text || '');
    doc.language = lang;
    const doMask = opts.maskPII !== false;
    if (doMask && doc.text) {
        doc.text = (0, pii_1.maskPII)(doc.text);
    }
    return doc;
}
