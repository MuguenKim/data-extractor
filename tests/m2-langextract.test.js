const fs = require('fs');
const path = require('path');
const { assert } = require('./helpers/assert');

// Use real backends only; skip this test when keys are missing
process.env.DEFAULT_BACKEND = process.env.DEFAULT_BACKEND || 'groq';
process.env.CONFIDENCE_THRESHOLD_CRITICAL = process.env.CONFIDENCE_THRESHOLD_CRITICAL || '0.9';

const { extract_with_langextract } = require('../packages/core/src/langextract/index.js');
const { ingestBufferAsync } = require('../packages/core/src/ingest/index.js');
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JSON import in JS test
const schema = require('../packages/core/src/schemas/invoice.v1.json');

function getCoverage(env, schema) {
  const critical = schema.fields.filter(f => !!f.critical).map(f => f.name);
  let have = 0;
  for (const name of critical) {
    const fr = env.fields?.[name];
    if (fr && Array.isArray(fr.spans) && fr.spans.length > 0 && fr.value !== null && fr.value !== undefined) {
      have++;
    }
  }
  return { have, total: critical.length, ratio: critical.length ? (have/critical.length) : 1 };
}

async function extractTextFixture(file) {
  const p = path.join(process.cwd(), 'fixtures', file);
  const buf = fs.readFileSync(p);
  const mime = file.endsWith('.html') ? 'text/html' : 'text/plain';
  const doc = await ingestBufferAsync(buf, { filename: file, mime });
  return doc.text;
}

async function run() {
  const textFiles = ['invoice.txt'];
  let have = 0, total = 0;
  for (const f of textFiles) {
    const text = await extractTextFixture(f);
    // If neither GROQ nor OLLAMA is configured, skip test gracefully
    const hasGroq = !!process.env.GROQ_API_KEY;
    const hasOllama = !!process.env.OLLAMA_HOST;
    if (!hasGroq && !hasOllama) {
      console.log('SKIP m2-langextract: no GROQ_API_KEY or OLLAMA_HOST configured');
      return;
    }
    const prefer = hasGroq ? 'groq' : 'ollama';
    const env = await extract_with_langextract({ schema, text, backend: prefer });
    const cov = getCoverage(env, schema);
    have += cov.have;
    total += cov.total;
  }
  const ratio = total ? (have/total) : 1;
  assert.ok(ratio >= 0.9, `Expected >=0.9 critical-span coverage, got ${ratio.toFixed(2)} (${have}/${total})`);
}

module.exports = run;
