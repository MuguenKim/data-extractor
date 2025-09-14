"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestHTML = ingestHTML;
exports.ingestHTMLString = ingestHTMLString;
const markdown_1 = require("./markdown");
function ingestHTML(buf, opts) {
    const raw = buf.toString('utf8');
    const md = (0, markdown_1.htmlToMarkdown)(raw);
    const pageMap = [{ page: 1, start: 0, end: md.length }];
    const warnings = [];
    return {
        text: md,
        pageMap,
        warnings,
        meta: { adapter: 'html', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
    };
}
function ingestHTMLString(html, opts) {
    const md = (0, markdown_1.htmlToMarkdown)(html);
    const pageMap = [{ page: 1, start: 0, end: md.length }];
    return {
        text: md,
        pageMap,
        warnings: [],
        meta: { adapter: 'url', mime: opts.mime, filename: opts.filename, bytes: Buffer.byteLength(html) }
    };
}
