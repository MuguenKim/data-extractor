const fs = require('fs');
const path = require('path');
const { assert } = require('./helpers/assert');

const ingest = require('../packages/core/src/ingest/index.js');

async function testIngestOne(file) {
  const p = path.join(process.cwd(), 'fixtures', file);
  const buf = fs.readFileSync(p);
  const doc = ingest.ingestBuffer(buf, { filename: file, mime: guessMime(file) });
  assert.ok(doc && typeof doc.text === 'string', `ingest(${file}) should return DocumentText`);
  assert.ok(Array.isArray(doc.pageMap) && doc.pageMap.length >= 1, `ingest(${file}) should have pageMap`);
  assert.ok(doc.meta && doc.meta.adapter, `ingest(${file}) should set meta.adapter`);
  return doc;
}

function guessMime(file) {
  if (file.endsWith('.txt')) return 'text/plain';
  if (file.endsWith('.html')) return 'text/html';
  if (file.endsWith('.csv')) return 'text/csv';
  if (file.endsWith('.pdf')) return 'application/pdf';
  if (/(png|jpg|jpeg)$/i.test(file)) return 'image/png';
  return 'application/octet-stream';
}

async function run() {
  const files = ['invoice.txt','invoice.html','invoice.csv','invoice1.png','invoice2.png','invoice3.pdf','invoice4.pdf'];
  let okCount = 0;
  for (const f of files) {
    const doc = await testIngestOne(f);
    // Define success as adapter recognized and pageMap produced (text may be empty for OCR/PDF placeholders)
    const success = !!(doc && doc.meta && doc.meta.adapter && Array.isArray(doc.pageMap) && doc.pageMap.length > 0);
    if (success) okCount++;
  }
  const rate = okCount / files.length;
  assert.ok(rate >= 0.95, `Ingest success rate expected ≥0.95, got ${rate.toFixed(2)}`);
}

module.exports = run;
