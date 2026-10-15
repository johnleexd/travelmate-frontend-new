import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const source = process.argv[2];
if (!source) throw new Error('Pass a local NASA Blue Marble source JPEG. See public/discovery/NOTICE.md.');
await mkdir(new URL('../public/discovery/', import.meta.url), { recursive: true });
for (const width of [1024, 2048]) await sharp(source).resize(width, width / 2).webp({ quality: 78 }).toFile(new URL('../public/discovery/earth-' + width + '.webp', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
