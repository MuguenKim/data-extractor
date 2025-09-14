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
exports.ingestEML = ingestEML;
exports.ingestMSG = ingestMSG;
exports.ingestMSGAsync = ingestMSGAsync;
exports.ingestMHTML = ingestMHTML;
const markdown_1 = require("./markdown");
function parseHeaders(raw) {
    const headers = {};
    const lines = raw.split(/\r?\n/);
    let i = 0;
    let curKey = null;
    for (; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') {
            i++;
            break;
        }
        if (/^[\t ]/.test(line) && curKey) {
            headers[curKey] += ' ' + line.trim();
        }
        else {
            const m = line.match(/^(.*?):\s*(.*)$/);
            if (m) {
                curKey = m[1].toLowerCase();
                headers[curKey] = m[2];
            }
        }
    }
    return headers;
}
function getBoundary(ct) {
    if (!ct)
        return null;
    const m = ct.match(/boundary=\"?([^\";]+)\"?/i);
    return m ? m[1] : null;
}
function splitMultipart(body, boundary) {
    const parts = [];
    const sep = `--${boundary}`;
    const end = `--${boundary}--`;
    const chunks = body.split(sep).map(s => s.replace(/^\r?\n/, ''));
    for (const c of chunks) {
        if (!c || c.startsWith('--'))
            continue;
        const idx = c.indexOf('\n\n');
        const headRaw = idx >= 0 ? c.slice(0, idx) : '';
        const content = idx >= 0 ? c.slice(idx + 2) : c;
        const headers = parseHeaders(headRaw);
        const id = headers['content-id'] || headers['content-location'] || headers['content-type'] || 'part';
        parts.push({ headers, content, id });
    }
    return parts;
}
function ingestEML(buf, opts) {
    const raw = buf.toString('utf8');
    const idx = raw.indexOf('\n\n');
    const headRaw = idx >= 0 ? raw.slice(0, idx) : raw;
    const body = idx >= 0 ? raw.slice(idx + 2) : '';
    const headers = parseHeaders(headRaw);
    const ct = headers['content-type'] || '';
    const boundary = getBoundary(ct);
    const warnings = [];
    let text = '';
    const pageMap = [{ page: 1, start: 0, end: 0 }];
    if (boundary) {
        const parts = splitMultipart(body, boundary);
        // Prefer text/plain, fallback to text/html
        const textPart = parts.find(p => /text\/plain/i.test(p.headers['content-type'] || ''));
        const htmlPart = parts.find(p => /text\/html/i.test(p.headers['content-type'] || ''));
        if (textPart) {
            text = textPart.content.replace(/\r/g, '');
        }
        else if (htmlPart) {
            text = (0, markdown_1.htmlToMarkdown)(htmlPart.content);
            warnings.push('Email had only HTML body; converted to Markdown');
        }
        else {
            // Concatenate all parts as plain text
            text = parts.map(p => p.content).join('\n\n');
            warnings.push('Email body parts were non-text; concatenated raw');
        }
    }
    else {
        // Single-part: check HTML or plain
        if (/text\/html/i.test(ct) || /<html/i.test(body)) {
            text = (0, markdown_1.htmlToMarkdown)(body);
        }
        else {
            text = body.replace(/\r/g, '');
        }
    }
    pageMap[0].end = text.length;
    return {
        text,
        pageMap,
        warnings,
        meta: { adapter: 'eml', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
    };
}
function ingestMSG(buf, opts) {
    // .msg (Outlook) is OLE2/CFB; needs a real parser. Placeholder only.
    const warnings = ['MSG parsing not implemented in dev; please forward as EML or use MBOX export.'];
    return {
        text: '',
        pageMap: [{ page: 1, start: 0, end: 0 }],
        warnings,
        meta: { adapter: 'msg', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
    };
}
async function ingestMSGAsync(buf, opts) {
    try {
        const m = await Promise.resolve().then(() => __importStar(require('msgreader')));
        const MSGReader = m.default || m;
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        const reader = new MSGReader(ab);
        const data = reader.getFileData();
        let text = '';
        const warnings = [];
        if (data?.body) {
            text = String(data.body);
        }
        else if (data?.bodyHTML) {
            text = (0, markdown_1.htmlToMarkdown)(String(data.bodyHTML));
            warnings.push('MSG had only HTML body; converted to Markdown');
        }
        return {
            text,
            pageMap: [{ page: 1, start: 0, end: text.length }],
            warnings,
            meta: { adapter: 'msg', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
        };
    }
    catch (e) {
        return ingestMSG(buf, opts);
    }
}
function ingestMHTML(buf, opts) {
    const raw = buf.toString('utf8');
    // MHTML is multipart/related; reuse email multipart parsing
    const idx = raw.indexOf('\n\n');
    const headRaw = idx >= 0 ? raw.slice(0, idx) : raw;
    const body = idx >= 0 ? raw.slice(idx + 2) : '';
    const headers = parseHeaders(headRaw);
    const boundary = getBoundary(headers['content-type'] || '');
    let text = '';
    const warnings = [];
    if (boundary) {
        const parts = splitMultipart(body, boundary);
        const htmlPart = parts.find(p => /text\/html/i.test(p.headers['content-type'] || '')) || parts[0];
        if (htmlPart)
            text = (0, markdown_1.htmlToMarkdown)(htmlPart.content);
        else {
            text = body;
            warnings.push('No text/html part found in MHTML');
        }
    }
    else {
        text = (0, markdown_1.htmlToMarkdown)(body);
    }
    const pageMap = [{ page: 1, start: 0, end: text.length }];
    return {
        text,
        pageMap,
        warnings,
        meta: { adapter: 'mhtml', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
    };
}
