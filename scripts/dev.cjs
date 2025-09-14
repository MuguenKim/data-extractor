#!/usr/bin/env node
/*
 Cross-platform dev runner for API/Web/Worker.
 Commands: up | down | restart | status
*/
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PIDS_DIR = path.join(ROOT, '.dev');
const API_PORT = process.env.API_PORT || '3001';
const WORKER_HTTP_PORT = process.env.WORKER_HTTP_PORT || '3002';
const WEB_PORT = process.env.WEB_PORT || '3000';

if (!fs.existsSync(PIDS_DIR)) fs.mkdirSync(PIDS_DIR, { recursive: true });

function startOne(name, dir, script) {
  console.log(`[dev] starting ${name} in ${dir} ...`);
  const child = spawn('pnpm', [script], {
    cwd: path.join(ROOT, dir),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  fs.writeFileSync(path.join(PIDS_DIR, `${name}.pid`), String(child.pid));
  console.log(`[dev] ${name} pid=${child.pid}`);
}

function stopOne(name) {
  const pidFile = path.join(PIDS_DIR, `${name}.pid`);
  if (!fs.existsSync(pidFile)) return;
  const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
  if (Number.isFinite(pid)) {
    try {
      console.log(`[dev] stopping ${name} pid=${pid} ...`);
      process.kill(pid);
    } catch (_) {}
  }
  try { fs.unlinkSync(pidFile); } catch (_) {}
}

async function httpStatus(url) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(to);
    return res.status === 200 ? 'OK' : `DOWN (${res.status})`;
  } catch {
    clearTimeout(to);
    return 'DOWN';
  }
}

async function status() {
  const s1 = await httpStatus(`http://localhost:${API_PORT}/health`);
  const s2 = await httpStatus(`http://localhost:${WORKER_HTTP_PORT}/health`);
  const s3 = await httpStatus(`http://localhost:${WEB_PORT}/api/health`);
  console.log(`[dev] api: ${s1}`);
  console.log(`[dev] worker: ${s2}`);
  console.log(`[dev] web: ${s3}`);
}

async function up() {
  // Ensure core is built so @api can import compiled JS
  await new Promise((resolve, reject) => {
    console.log('[dev] building @core ...');
    const p = spawn('pnpm', ['-r', '--filter', '@core', 'build'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    p.on('close', (code) => (code === 0 ? resolve(null) : reject(new Error('build failed'))));
  });

  startOne('api', 'apps/api', 'dev');
  startOne('worker', 'apps/worker', 'dev');
  startOne('web', 'apps/web', 'dev');
  console.log('[dev] waiting for health checks...');
  setTimeout(status, 2000);
}

async function down() {
  stopOne('web');
  stopOne('worker');
  stopOne('api');
}

async function restart() {
  await down();
  setTimeout(up, 500);
}

const cmd = process.argv[2] || '';
if (cmd === 'up') up();
else if (cmd === 'down' || cmd === 'stop') down();
else if (cmd === 'restart') restart();
else if (cmd === 'status') status();
else {
  console.log('Usage: node scripts/dev.cjs [up|down|restart|status]');
  process.exit(1);
}
