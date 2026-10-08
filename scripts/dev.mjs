import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.resolve(frontendRoot, '../travelmate-backend-api');
// Keep frontend .env.local values out of the backend's environment.
const backendEnv = { ...process.env, NODE_ENV: 'development' };
nextEnv.loadEnvConfig(frontendRoot, true);
const backendUrl = new URL(process.env.BACKEND_URL || 'http://localhost:5000');
const children = new Set();
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === 'win32') {
      // Next and Node's watch mode create descendants; stop only our own trees.
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ }
    }
  }
  process.exit(code);
}

function start(name, args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd, env, stdio: 'inherit', detached: process.platform !== 'win32',
  });
  children.add(child);
  child.on('error', (error) => {
    console.error(`[dev] Could not start ${name}: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[dev] ${name} stopped (${signal || code}).`);
      stop(code || (signal ? 1 : 0));
    }
  });
  return child;
}

async function apiReady() {
  try {
    const response = await fetch(new URL('/', backendUrl), { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    const data = await response.json();
    return data.name === 'TravelMate API' && data.status === 'ok';
  } catch { return false; }
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

try {
  if (await apiReady()) {
    console.log(`[dev] Reusing TravelMate API at ${backendUrl.origin}`);
  } else {
    const local = backendUrl.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(backendUrl.hostname);
    if (!local) {
      throw new Error('The configured BACKEND_URL is unavailable. Start that API or correct BACKEND_URL in .env.local.');
    }
    if (!existsSync(path.join(backendRoot, 'src/server.ts'))
      || !existsSync(path.join(backendRoot, 'node_modules'))) {
      throw new Error('Install the sibling backend first: cd ../travelmate-backend-api && npm install');
    }
    console.log(`[dev] Starting TravelMate API at ${backendUrl.origin}...`);
    start('Backend', [path.join(backendRoot, 'scripts/dev.mjs')], backendRoot, {
      ...backendEnv, PORT: backendUrl.port || '80',
    });
    const deadline = Date.now() + 30_000;
    while (!(await apiReady())) {
      if (Date.now() >= deadline) {
        throw new Error('Backend did not become ready within 30 seconds. Check the backend error above and its .env (including DATABASE_URL).');
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    console.log('[dev] TravelMate API is ready.');
  }
  start('Frontend', [path.join(frontendRoot, 'node_modules/next/dist/bin/next'), 'dev', ...process.argv.slice(2)],
    frontendRoot, process.env);
} catch (error) {
  console.error(`[dev] ${error.message}`);
  stop(1);
}
