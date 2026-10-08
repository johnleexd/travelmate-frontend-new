import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const globRequire = createRequire(require.resolve('micromatch'));
const braces = globRequire('braces');

test('the installed brace override retains ordinary expansion and glob matching', () => {
  assert.equal(globRequire('braces/package.json').version, '3.0.4-travelmate.1');
  assert.deepEqual(braces.expand('app/{page,layout}.{js,tsx}'), ['app/page.js', 'app/page.tsx', 'app/layout.js', 'app/layout.tsx']);
  assert.deepEqual(braces.expand('day-{1..3}'), ['day-1', 'day-2', 'day-3']);
  const micromatch = require('micromatch');
  assert.deepEqual(micromatch(['app/page.tsx', 'app/style.css'], '**/*.{ts,tsx}'), ['app/page.tsx']);
});

test('deep brace strings are rejected before any recursive walker runs', () => {
  const pattern = '{'.repeat(4000) + 'a,b' + '}'.repeat(4000);
  for (const operation of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => operation(pattern, { maxLength: 1_000_000 }), /supported nesting depth/);
  }
});

test('supplied deep or cyclic ASTs are rejected by every public walker', () => {
  let ast: { type: string; nodes: unknown[] } = { type: 'root', nodes: [] };
  for (let index = 0; index < 4000; index++) ast = { type: 'root', nodes: [ast] };
  const cycle: { type: string; nodes: unknown[] } = { type: 'root', nodes: [] };
  cycle.nodes.push(cycle);
  const parentCycle: { type: string; nodes: unknown[]; parent?: unknown } = { type: 'text', nodes: [] };
  parentCycle.parent = parentCycle;
  for (const operation of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => operation(ast), /supported depth/);
    assert.throws(() => operation(cycle), /cycle/);
    assert.throws(() => operation(parentCycle), /cycle/);
  }
});
