import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { type TestContext } from 'node:test';

const frontendRoot = fileURLToPath(new URL('../', import.meta.url));
const scriptPath = join(frontendRoot, 'scripts/sync-api-contracts.mjs');
const sourceFiles = [
  'openapi/travelmate-api.json',
  'src/lib/stored-trip-media.ts',
  'src/lib/trip-preferences.ts',
  'src/lib/expense-ledger.ts',
  'src/lib/currency.ts',
  'src/lib/currency-data.ts',
  'src/services/itinerary/transport-planning.ts',
];

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'travelmate-contract-sync-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const frontend = join(root, 'frontend');
  const backend = join(root, 'travelmate-backend-api');
  const generated = join(frontend, 'lib/generated');
  await mkdir(generated, { recursive: true });
  for (const source of sourceFiles) {
    const target = join(backend, source);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(frontendRoot, '../travelmate-backend-api', source), target);
  }
  const run = (...args: string[]) => {
    const result = spawnSync(process.execPath, [scriptPath, ...args], { cwd: frontend, encoding: 'utf8' });
    assert.ifError(result.error);
    return result;
  };
  return { backend, generated, run };
}

test('contract sync repairs null-filled modules and check detects corruption without writing', async t => {
  const { generated, run } = await fixture(t);
  const initial = run();
  assert.equal(initial.status, 0, initial.stderr);
  const files = await readdir(generated);
  assert.equal(files.length, 11);
  const expected = await Promise.all(files.map(file => readFile(join(generated, file), 'utf8')));
  for (const file of files) await writeFile(join(generated, file), Buffer.alloc(100));
  assert.equal(run('--check').status, 1);
  assert.deepEqual(await readFile(join(generated, files[0])), Buffer.alloc(100));
  const repaired = run();
  assert.equal(repaired.status, 0, repaired.stderr);
  assert.deepEqual(await Promise.all(files.map(file => readFile(join(generated, file), 'utf8'))), expected);
  assert.equal(run('--check').status, 0);
  assert.deepEqual(await readdir(generated), files);
});

test('contract sync accepts Windows line endings and leaves unchanged files untouched', async t => {
  const { generated, run } = await fixture(t);
  assert.equal(run().status, 0);
  const files = await readdir(generated);
  for (const file of files) {
    const target = join(generated, file);
    await writeFile(target, (await readFile(target, 'utf8')).replace(/\r?\n/g, '\r\n'));
  }
  const before = await Promise.all(files.map(file => stat(join(generated, file))));
  const checked = run('--check');
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(run().status, 0);
  const after = await Promise.all(files.map(file => stat(join(generated, file))));
  assert.deepEqual(after.map(info => info.mtimeMs), before.map(info => info.mtimeMs));
});

test('corrupted backend sources fail before replacing any existing contract', async t => {
  const { backend, generated, run } = await fixture(t);
  assert.equal(run().status, 0);
  const target = join(generated, 'api-error-contract.ts');
  await writeFile(target, '// existing module to preserve\n');
  await writeFile(join(backend, 'src/services/itinerary/transport-planning.ts'), Buffer.alloc(100));
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /source contains null bytes/);
  assert.equal(await readFile(target, 'utf8'), '// existing module to preserve\n');
  assert.equal((await readdir(generated)).some(file => file.endsWith('.tmp')), false);
});
