import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve(import.meta.dirname, '..', 'demo-dist');
const indexPath = resolve(outputDirectory, 'index.html');
const explorerPath = resolve(outputDirectory, 'explorer', 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');
const explorerHtml = await readFile(explorerPath, 'utf8');

const providerOrigins = [
  'https://api.iconify.design',
  'https://cdn.jsdelivr.net',
  'https://cdn.simpleicons.org',
];

const pages = [
  {
    name: 'landing page',
    html: indexHtml,
    connectOrigins: providerOrigins.slice(0, 2),
  },
  {
    name: 'explorer page',
    html: explorerHtml,
    connectOrigins: providerOrigins,
  },
];

function getDirectiveSources(html, directive) {
  return new Set(
    new RegExp(`${directive}\\s+([^;]+)`).exec(html)?.[1].split(/\s+/) ?? [],
  );
}

for (const { name, html, connectOrigins } of pages) {
  if (!html.includes('/icon-picker/assets/')) {
    throw new Error(`${name} assets are not rooted at the /icon-picker/ Pages subpath.`);
  }

  if (html.includes('="/assets/')) {
    throw new Error(`${name} contains a root-relative asset that will fail on GitHub Pages.`);
  }

  for (const [directive, origins] of [
    ['connect-src', connectOrigins],
    ['img-src', providerOrigins],
  ]) {
    const sources = getDirectiveSources(html, directive);
    for (const origin of origins) {
      if (!sources.has(origin)) {
        throw new Error(`${name} CSP ${directive} is missing provider origin: ${origin}`);
      }
    }
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
  `Verified static Pages demo: 2 pages, ${assets.length} assets, ${outputStats.size} byte landing document.`,
);
