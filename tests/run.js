#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function findTests(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findTests(p));
    else if (/\.test\.js$/i.test(entry.name)) out.push(p);
  }
  return out;
}

async function run() {
  const t0 = Date.now();
  const files = findTests(path.join(__dirname));
  let passed = 0, failed = 0;
  for (const f of files) {
    try {
      const mod = require(f);
      if (typeof mod === 'function') await mod();
      else if (mod && typeof mod.default === 'function') await mod.default();
      else if (mod && typeof mod.run === 'function') await mod.run();
      else if (mod && typeof mod.test === 'function') await mod.test();
      else if (mod && typeof mod.main === 'function') await mod.main();
      else if (mod && typeof mod.tests === 'object') {
        for (const [name, fn] of Object.entries(mod.tests)) {
          await fn();
        }
      }
      console.log(`PASS ${path.relative(process.cwd(), f)}`);
      passed++;
    } catch (e) {
      console.error(`FAIL ${path.relative(process.cwd(), f)}: ${e.message}`);
      if (e.stack) console.error(e.stack.split('\n').slice(0,4).join('\n'));
      failed++;
    }
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`\nTests finished: ${passed} passed, ${failed} failed in ${dt}s`);
  process.exitCode = failed ? 1 : 0;
}

run();
