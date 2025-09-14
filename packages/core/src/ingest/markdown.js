"use strict";
// Minimal HTML -> Markdown conversion (no external deps)
// Covers headings, lists, emphasis, links, images, tables (basic), and blocks.
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlToMarkdown = htmlToMarkdown;
function decodeEntities(s) {
    const map = {
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' '
    };
    return s.replace(/(&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;)/g, (m) => map[m] || m);
}
function htmlToMarkdown(html) {
    let s = html || '';
    // Remove script/style content
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '');
    // Headings
    for (let i = 6; i >= 1; i--) {
        const re = new RegExp(`<h${i}[^>]*>([\s\S]*?)<\\/h${i}>`, 'gi');
        s = s.replace(re, (_, inner) => `\n${'#'.repeat(i)} ${inner.trim()}\n`);
    }
    // Bold & italics -> keep plain text (no markdown markers)
    s = s.replace(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, '$1');
    s = s.replace(/<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, '$1');
    // Links
    s = s.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
    // Images -> Markdown image
    s = s.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, '![$1]($2)');
    s = s.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '![]($1)');
    // Lists
    s = s.replace(/<li[^>]*>\s*([\s\S]*?)\s*<\/li>/gi, '- $1\n');
    s = s.replace(/<\/(?:ul|ol)>/gi, '\n');
    s = s.replace(/<(?:ul|ol)[^>]*>/gi, '\n');
    // Tables: convert rows to pipe-separated lines
    s = s.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, inner) => {
        const cells = inner
            .replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, '$1|')
            .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, '$1|')
            .replace(/<[^>]+>/g, '')
            .split('|')
            .map((x) => x.trim())
            .filter(Boolean);
        return cells.length ? `| ${cells.join(' | ')} |\n` : '';
    });
    // Block elements -> newline breaks
    s = s.replace(/<(?:p|div|br|section|article|header|footer|hr)[^>]*>/gi, '\n');
    s = s.replace(/<\/(?:p|div|section|article|header|footer)>/gi, '\n');
    // Strip remaining tags
    s = s.replace(/<[^>]+>/g, '');
    // Decode entities and normalize whitespace
    s = decodeEntities(s);
    s = s.replace(/[ \t]+/g, ' ');
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
}
