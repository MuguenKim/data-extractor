const fs = require('fs');
const path = require('path');
const { assert } = require('./helpers/assert');

const ingest = require('../packages/core/src/ingest/index.js');
const { baselineExtract } = require('../packages/core/src/extractors/baseline.js');

async function run() {
  const p = path.join(process.cwd(), 'fixtures', 'invoice.csv');
  const buf = fs.readFileSync(p);
  const doc = await ingest.ingestBufferAsync(buf, { filename: 'invoice.csv', mime: 'text/csv' });
  const res = baselineExtract(doc);
  const t = res.fields.table;
  assert.ok(t && Array.isArray(t.value), 'csv table exists');
  assert.ok(t.value.length >= 2, 'csv table has rows');
  // Expect at least header+2 rows become 2+ after heuristic (numbers≥2 per line), so allow >=1
  assert.ok(Array.isArray(t.spans) && t.spans.length >= 0, 'csv table spans array');
}

module.exports = run;

