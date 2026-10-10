import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outputDirectory = resolve(root, 'standalone-dist');
const indexPath = resolve(outputDirectory, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');

if (!indexHtml.includes('="/assets/')) {
  throw new Error('Standalone assets are not rooted at /.');
}
if (indexHtml.includes('/icon-picker/')) {
  throw new Error('Standalone output depends on the GitHub Pages base path.');
}

const providerOrigins = [
  'https://api.iconify.design',
  'https://cdn.jsdelivr.net',
  'https://cdn.simpleicons.org',
];
for (const directive of ['connect-src', 'img-src']) {
  const sources = new Set(
    new RegExp(`${directive}\\s+([^;]+)`).exec(indexHtml)?.[1].split(/\s+/) ?? [],
  );
  for (const origin of providerOrigins) {
    if (!sources.has(origin)) {
      throw new Error(`Standalone CSP ${directive} is missing ${origin}.`);
    }
  }
}

const assetsDirectory = resolve(outputDirectory, 'assets');
const assets = await readdir(assetsDirectory);
if (!assets.some((file) => file.endsWith('.js'))) {
  throw new Error('Standalone build did not emit JavaScript.');
}
if (!assets.some((file) => file.endsWith('.css'))) {
  throw new Error('Standalone build did not emit CSS.');
}

const nginxConfig = await readFile(resolve(root, 'deploy/nginx.conf'), 'utf8');
for (const expected of [
  'listen 8080',
  'location = /healthz',
  'max-age=31536000, immutable',
  'try_files $uri $uri/ /index.html',
]) {
  if (!nginxConfig.includes(expected)) {
    throw new Error(`Nginx configuration is missing: ${expected}`);
  }
}

const outputStats = await stat(indexPath);
console.log(
  `Verified standalone explorer: root index, ${assets.length} hashed assets, ${outputStats.size} byte document.`,
);
