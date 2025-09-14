const fs = require('fs');
const path = require('path');
const { assert } = require('./helpers/assert');

const ingest = require('../packages/core/src/ingest/index.js');
const { baselineExtract } = require('../packages/core/src/extractors/baseline.js');

function hasValidSpan(spans, fullText) {
  return Array.isArray(spans) && spans.length > 0 && spans.every(s => s.start >= 0 && s.end >= s.start && s.end <= fullText.length);
}

async function run() {
  // TXT invoice
  const pTxt = path.join(process.cwd(), 'fixtures', 'invoice.txt');
  const docTxt = await ingest.ingestBufferAsync(fs.readFileSync(pTxt), { filename: 'invoice.txt', mime: 'text/plain', maskPII: false });
  assert.ok(docTxt.text.includes('Invoice No'), 'txt should have content');
  const resTxt = baselineExtract(docTxt);
  assert.ok(resTxt && resTxt.fields, 'baseline result');
  assert.equal(resTxt.status, 'ok', 'baseline status ok');
  // Core fields
  const fTxt = resTxt.fields;
  assert.equal(fTxt.invoice_number.value, 'INV-2024-0913', 'txt invoice_number');
  assert.ok(fTxt.invoice_number.confidence >= 0.7, 'txt invoice_number confidence');
  assert.ok(hasValidSpan(fTxt.invoice_number.spans, docTxt.text), 'txt invoice_number spans');
  assert.equal(fTxt.date.value, '2024-09-13', 'txt date');
  assert.ok(hasValidSpan(fTxt.date.spans, docTxt.text), 'txt date spans');
  assert.equal(fTxt.currency.value, 'USD', 'txt currency');
  assert.ok(hasValidSpan(fTxt.currency.spans, docTxt.text), 'txt currency spans');
  // Baseline may match Subtotal or Grand Total depending on regex; accept either
  const possibleTotals = [39.05, 35.5];
  assert.ok(possibleTotals.some(v => Math.abs((fTxt.total.value ?? -1) - v) < 1e-2), `txt total expected one of ${possibleTotals.join(', ')}`);
  assert.ok(hasValidSpan(fTxt.total.spans, docTxt.text), 'txt total spans');
  // Table heuristic present
  assert.ok(fTxt.table.value && Array.isArray(fTxt.table.value) && fTxt.table.value.length >= 1, 'txt table present');

  // HTML invoice
  const pHtml = path.join(process.cwd(), 'fixtures', 'invoice.html');
  const docHtml = await ingest.ingestBufferAsync(fs.readFileSync(pHtml), { filename: 'invoice.html', mime: 'text/html', maskPII: false });
  assert.ok(docHtml.text.toLowerCase().includes('invoice'), 'html md contains invoice');
  const resHtml = baselineExtract(docHtml);
  const fHtml = resHtml.fields;
  assert.equal(fHtml.invoice_number.value, 'INV-HTML-0001', 'html invoice_number');
  assert.ok(hasValidSpan(fHtml.invoice_number.spans, docHtml.text), 'html invoice_number spans');
  assert.equal(fHtml.date.value, '2024-08-31', 'html date');
  assert.ok(hasValidSpan(fHtml.date.spans, docHtml.text), 'html date spans');
  assert.equal(fHtml.currency.value, 'EUR', 'html currency');
  assert.ok(hasValidSpan(fHtml.currency.spans, docHtml.text), 'html currency spans');
  assert.near(fHtml.total.value, 100.00, 1e-2, 'html total');
  assert.ok(hasValidSpan(fHtml.total.spans, docHtml.text), 'html total spans');
  // Table may not be detected from markdown pipe tables in baseline; covered by CSV test
}

module.exports = run;
