const fs = require('fs');
const path = require('path');
const { assert } = require('./helpers/assert');

const ingest = require('../packages/core/src/ingest/index.js');
const { baselineExtract } = require('../packages/core/src/extractors/baseline.js');

async function run() {
  const files = ['invoice1.png','invoice2.png','invoice3.pdf','invoice4.pdf'];
  for (const f of files) {
    const p = path.join(process.cwd(), 'fixtures', f);
    const buf = fs.readFileSync(p);
    const mime = f.endsWith('.pdf') ? 'application/pdf' : 'image/png';
    const doc = ingest.ingestBuffer(buf, { filename: f, mime });
    assert.ok(doc && Array.isArray(doc.pageMap), `${f}: has pageMap`);
    assert.ok(Array.isArray(doc.warnings), `${f}: has warnings`);

    const res = baselineExtract(doc);
    for (const [k, v] of Object.entries(res.fields)) {
      // With empty text, spans must be missing and values nulled per policy
      if (!doc.text) {
        assert.ok(!v.value, `${f}: ${k} value should be null without text`);
      }
    }
  }
}

module.exports = run;
