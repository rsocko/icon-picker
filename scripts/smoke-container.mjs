import { setTimeout as delay } from 'node:timers/promises';

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:18080').replace(/\/$/, '');

async function get(path) {
  const response = await globalThis.fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}.`);
  }
  return response;
}

let health;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    health = await get('/healthz');
    break;
  } catch {
    await delay(500);
  }
}
if (!health || (await health.text()) !== 'ok\n') {
  throw new Error('Container health endpoint did not become ready.');
}
if (health.headers.get('cache-control') !== 'no-store') {
  throw new Error('Health response must not be cached.');
}

const root = await get('/');
const html = await root.text();
if (!html.includes('<title>Icon Explorer</title>')) {
  throw new Error('Container root does not serve the explorer.');
}
if (!root.headers.get('content-security-policy')?.includes('api.iconify.design')) {
  throw new Error('Container response is missing the provider CSP.');
}
if (root.headers.get('cache-control') !== 'no-cache') {
  throw new Error('Explorer HTML must be revalidated.');
}

const assetPath = /(?:src|href)="(\/assets\/[^"]+)"/.exec(html)?.[1];
if (!assetPath) throw new Error('Explorer document has no root-relative asset.');
const asset = await get(assetPath);
if (asset.headers.get('cache-control') !== 'public, max-age=31536000, immutable') {
  throw new Error('Hashed assets do not have immutable caching.');
}

const fallback = await get('/nonexistent/client/route');
if (!(await fallback.text()).includes('<title>Icon Explorer</title>')) {
  throw new Error('Static route fallback does not serve the explorer.');
}

console.log(`Verified container at ${baseUrl}: health, root, headers, asset cache, fallback.`);
