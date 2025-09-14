"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.baselineExtract = baselineExtract;
function findSpan(text, value) {
    if (!value)
        return [];
    const idx = text.indexOf(String(value));
    if (idx === -1)
        return [];
    return [{ start: idx, end: idx + String(value).length }];
}
function num(v) {
    const cleaned = v.replace(/[^0-9.,-]/g, "").replace(/,(?=\d{3}\b)/g, "");
    const withDot = cleaned.replace(/,/g, ".");
    const n = parseFloat(withDot);
    return isFinite(n) ? n : null;
}
function baselineExtract(doc, _opts = {}) {
    const text = doc.text || "";
    const warnings = [...(doc.warnings || [])];
    const fields = {
        invoice_number: { value: null, confidence: 0, spans: [] },
        date: { value: null, confidence: 0, spans: [] },
        currency: { value: null, confidence: 0, spans: [] },
        total: { value: null, confidence: 0, spans: [] },
        table: { value: null, confidence: 0, spans: [] },
    };
    // Heuristic: label-led invoice number
    const invLabelRe = /(invoice\s*(no\.?|#|number)\s*[:\-]?\s*)([A-Z0-9\-_/]{3,})/i;
    const invFreeRe = /\b(?:inv|invoice)[-_/ ]?([A-Z0-9]{3,})\b/i;
    let m = text.match(invLabelRe);
    if (m) {
        fields.invoice_number.value = m[3];
        fields.invoice_number.confidence = 0.92;
        fields.invoice_number.spans = findSpan(text, m[0]);
    }
    else {
        m = text.match(invFreeRe);
        if (m) {
            fields.invoice_number.value = m[1];
            fields.invoice_number.confidence = 0.7;
            fields.invoice_number.spans = findSpan(text, m[0]);
        }
    }
    // Dates: prefer label-led then generic
    const dateLabelRe = /(date\s*[:\-]?\s*)(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4})/i;
    const dateAnyRe = /(\b\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\b|\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b)/;
    m = text.match(dateLabelRe);
    if (m) {
        fields.date.value = m[2];
        fields.date.confidence = 0.9;
        fields.date.spans = findSpan(text, m[0]);
    }
    else {
        m = text.match(dateAnyRe);
        if (m) {
            fields.date.value = m[1] || m[0];
            fields.date.confidence = 0.6;
            fields.date.spans = findSpan(text, m[0]);
        }
    }
    // Currency: code first then symbol
    const currencyCodeRe = /\b(USD|EUR|TND|GBP|CAD|AUD|JPY|CNY|INR|MAD|AED)\b/;
    const currencySymRe = /([$€£]|TND|DT)/;
    m = text.match(currencyCodeRe);
    if (m) {
        fields.currency.value = m[1];
        fields.currency.confidence = 0.88;
        fields.currency.spans = findSpan(text, m[0]);
    }
    else {
        m = text.match(currencySymRe);
        if (m) {
            const sym = m[1];
            const map = { "$": "USD", "€": "EUR", "£": "GBP", DT: "TND", TND: "TND" };
            fields.currency.value = map[sym] || sym;
            fields.currency.confidence = 0.6;
            fields.currency.spans = findSpan(text, m[0]);
        }
    }
    // Total: prefer label-led lines containing total
    const totalLineRe = /(grand\s*)?total\s*[:\-]?\s*([$€£DT ]*)(([0-9]{1,3}(?:[.,][0-9]{3})*|[0-9]+)(?:[.,][0-9]{2})?)/i;
    m = text.match(totalLineRe);
    if (m) {
        const raw = m[3];
        const n = num(raw);
        fields.total.value = n ?? null;
        fields.total.confidence = n != null ? 0.93 : 0.4;
        fields.total.spans = findSpan(text, m[0]);
    }
    else {
        // fallback: largest number heuristic
        const nums = [...text.matchAll(/\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})\b/g)].map((mm) => ({
            raw: mm[0],
            n: num(mm[0]) || 0,
            s: mm.index || 0,
        }));
        if (nums.length) {
            nums.sort((a, b) => b.n - a.n);
            const pick = nums[0];
            fields.total.value = pick.n;
            fields.total.confidence = 0.55;
            fields.total.spans = [{ start: pick.s, end: pick.s + pick.raw.length }];
            warnings.push("Total inferred by numeric magnitude only");
        }
    }
    // Naive table detector: lines with at least two numbers
    const lines = text.split(/\n+/);
    const rows = [];
    for (const line of lines) {
        const cells = line.split(/\s{2,}|\t/).map((c) => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
            const numsInLine = (line.match(/\d+[.,]?\d*/g) || []).length;
            if (numsInLine >= 2)
                rows.push(cells);
        }
    }
    if (rows.length) {
        fields.table.value = rows;
        fields.table.confidence = 0.6;
        // For tables, span the whole block
        const first = text.indexOf(lines[0] || "");
        const lastLine = lines[lines.length - 1] || "";
        const last = lastLine ? text.lastIndexOf(lastLine) + lastLine.length : text.length;
        fields.table.spans = first >= 0 ? [{ start: first, end: last }] : [];
    }
    const result = {
        fields,
        warnings,
        validation: { rules_passed: [], rules_failed: [] },
        status: 'ok',
    };
    // Post-process: ensure spans present or null out values per AGENTS.md rules
    for (const [k, fr] of Object.entries(result.fields)) {
        if (!fr.spans || fr.spans.length === 0) {
            result.warnings.push(`Missing span for field: ${k}`);
            fr.value = null;
        }
    }
    return result;
}
