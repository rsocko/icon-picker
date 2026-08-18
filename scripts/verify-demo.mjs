import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve(import.meta.dirname, '..', 'demo-dist');
const indexPath = resolve(outputDirectory, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');

if (!indexHtml.includes('/icon-picker/assets/')) {
  throw new Error('Demo assets are not rooted at the /icon-picker/ Pages subpath.');
}

if (indexHtml.includes('="/assets/')) {
  throw new Error('Demo contains a root-relative asset that will fail on GitHub Pages.');
}

for (const origin of [
  'https://api.iconify.design',
  'https://cdn.jsdelivr.net',
  'https://cdn.simpleicons.org',
]) {
  if (!indexHtml.includes(origin)) {
    throw new Error(`Demo CSP is missing provider origin: ${origin}`);
  }
}

const assetsDirectory = resolve(outputDirectory, 'assets');
const assets = await readdir(assetsDirectory);
if (!assets.some((file) => file.endsWith('.js'))) {
  throw new Error('Demo build did not emit JavaScript.');
}
if (!assets.some((file) => file.endsWith('.css'))) {
  throw new Error('Demo build did not emit CSS.');
}

const outputStats = await stat(indexPath);
console.log(
  `Verified static Pages demo: ${assets.length} assets, ${outputStats.size} byte entry document.`,
);
