import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const directory = '.next/dev/static/chunks';
const results = [];
for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.js'))) {
  const body = fs.readFileSync(path.join(directory, name), 'utf8');
  const start = body.indexOf('const backToOverview =');
  if (start < 0) continue;
  const handler = body.slice(start, body.indexOf('const confirmPending', start));
  assert.ok(handler.includes("searchParams.delete('day')") || handler.includes('searchParams.delete("day")'));
  assert.equal(handler.includes('history.back'), false);
  const response = await fetch('http://localhost:3000/_next/static/chunks/' + encodeURIComponent(name), { cache: 'no-store' });
  assert.equal(response.status, 200);
  const served = await response.text();
  const hash = value => createHash('sha256').update(value).digest('hex');
  assert.equal(hash(served), hash(body));
  results.push({ chunk: name, httpStatus: response.status, sourceMatchesRunningServer: true, explicitDayRemoval: true, dayBackUsesHistoryBack: false, sha256: hash(body) });
}
assert.ok(results.length);
fs.writeFileSync('../audit/2026-10-13/explicit-cheonan-overview-back/served-frontend.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
