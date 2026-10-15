import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
const text = await fs.readFile('lib/discovery-destinations.ts', 'utf8');
const destinations = JSON.parse(text.slice(text.indexOf('[\n'), text.lastIndexOf(']') + 1));
await fs.mkdir('public/discovery/featured', { recursive: true });
const notices = [];
for (const destination of destinations) {
  // Existing verified Commons sources; no discovery API or new photo provider.
  const source = execFileSync('curl.exe', ['-fsSL', '--retry', '2', '--max-time', '40', destination.photo.url], { maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  await sharp(source).resize(320, 200, { fit: 'cover' }).webp({ quality: 78 }).toFile('public/discovery/featured/' + destination.id + '.webp');
  notices.push(destination.id + '.webp\nPhoto: ' + destination.photo.creator + '\nSource: ' + destination.photo.sourceUrl + '\nLicense: ' + destination.photo.license + ' ' + destination.photo.licenseUrl + '\nChanges: resized, cropped to 320 x 200 and encoded as WebP.\n');
}
await fs.writeFile('public/discovery/featured/NOTICE.txt', notices.join('\n'));
console.log('Prepared', destinations.length, 'licensed destination thumbnails');
