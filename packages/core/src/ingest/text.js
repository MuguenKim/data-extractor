"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestPlainText = ingestPlainText;
function ingestPlainText(buf, opts) {
    const text = buf.toString('utf8');
    const pageMap = [{ page: 1, start: 0, end: text.length }];
    return {
        text,
        pageMap,
        warnings: [],
        meta: { adapter: 'text', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
    };
}
