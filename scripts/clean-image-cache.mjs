import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

// Next.js 16 can fail every image request if an interrupted write leaves a
// zero-byte file in the disk cache. Remove only those invalid files before dev.
const cacheDir = path.resolve('.next/dev/cache/images');

async function entries(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

let removed = 0;
for (const cacheEntry of await entries(cacheDir)) {
  if (!cacheEntry.isDirectory()) continue;
  const entryDir = path.join(cacheDir, cacheEntry.name);
  for (const image of await entries(entryDir)) {
    if (!image.isFile()) continue;
    const imagePath = path.join(entryDir, image.name);
    if ((await stat(imagePath)).size === 0) {
      await unlink(imagePath);
      removed++;
    }
  }
}

if (removed > 0) console.log(`Removed ${removed} invalid zero-byte image cache file(s).`);
