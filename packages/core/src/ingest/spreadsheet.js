"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestSpreadsheet = ingestSpreadsheet;
function looksLikeCSVorTSV(buf) {
    const s = buf.toString('utf8');
    return /(,|\t).+\n/.test(s);
}
function ingestSpreadsheet(buf, opts) {
    // Minimal: if content looks like CSV/TSV, reuse as lines. Otherwise, placeholder.
    const warnings = [];
    let text = '';
    if (looksLikeCSVorTSV(buf)) {
        text = buf.toString('utf8').replace(/\r/g, '');
    }
    else {
        try {
            // Try XLSX via xlsx lib
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const XLSX = require('xlsx');
            const wb = XLSX.read(buf, { type: 'buffer' });
            const lines = [];
            const notes = [];
            wb.SheetNames.forEach((name, si) => {
                const ws = wb.Sheets[name];
                const csv = XLSX.utils.sheet_to_csv(ws, { FS: '\t' });
                const header = `# Sheet ${si + 1}: ${name}`;
                lines.push(header, csv.trim());
            });
            text = lines.join('\n');
        }
        catch (e) {
            warnings.push('Binary spreadsheet detected (XLSX/XLS/ODS); failed to parse: ' + (e?.message || String(e)));
        }
    }
    const pageMap = [{ page: 1, start: 0, end: text.length }];
    return {
        text,
        pageMap,
        warnings,
        meta: { adapter: 'spreadsheet', mime: opts.mime, filename: opts.filename, bytes: buf.byteLength }
    };
}
