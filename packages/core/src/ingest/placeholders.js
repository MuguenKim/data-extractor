"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestPlaceholder = ingestPlaceholder;
function ingestPlaceholder(buf, opts, kind, note) {
    const warnings = [note || `${kind} adapter not implemented; returning empty text.`];
    return {
        text: '',
        pageMap: [{ page: 1, start: 0, end: 0 }],
        warnings,
        meta: { adapter: kind, mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
    };
}
