import fs from 'node:fs/promises';
import sharp from 'sharp';

// Offline crop/encoding only. Preserve generated transparency; do not composite onto scenery.
const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error('Pass the directory containing clouds-source.png and mist-source.png');
for (const name of ['clouds', 'mist']) {
  const source = sourceDirectory + '/' + name + '-source.png';
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let top = info.height, bottom = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 4) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  if (top === info.height) throw new Error(name + ' is entirely transparent');
  top = Math.max(0, top - 24); bottom = Math.min(info.height - 1, bottom + 24);
  const output = 'public/discovery/cinematic/' + name + '-layer-v1.webp';
  await sharp(source).extract({ left: 0, top, width: info.width, height: bottom - top + 1 })
    .resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 76, alphaQuality: 85, effort: 5 }).toFile(output);
  await sharp(source).extract({ left: 0, top, width: info.width, height: bottom - top + 1 })
    .resize({ width: 760 }).webp({ quality: 72, alphaQuality: 80, effort: 5 }).toFile('public/discovery/cinematic/' + name + '-layer-mobile-v1.webp');
  const metadata = await sharp(output).metadata();
  console.log(JSON.stringify({ output, bytes: (await fs.stat(output)).size, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha, crop: { top, bottom } }));
}
