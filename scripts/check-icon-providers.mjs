import { appendFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const providers = [
  {
    name: 'Lucide',
    url: 'https://api.iconify.design/collection?prefix=lucide',
    expectedPrefix: 'lucide',
    minimumIcons: 1_000,
    smokeIcon: 'rocket',
  },
  {
    name: 'Material Design Icons',
    url: 'https://api.iconify.design/collection?prefix=mdi',
    expectedPrefix: 'mdi',
    minimumIcons: 5_000,
    smokeIcon: 'home',
  },
  {
    name: 'Phosphor',
    url: 'https://api.iconify.design/collection?prefix=ph',
    expectedPrefix: 'ph',
    minimumIcons: 5_000,
    smokeIcon: 'rocket',
  },
  {
    name: 'Simple Icons',
    url: 'https://api.iconify.design/collection?prefix=simple-icons',
    expectedPrefix: 'simple-icons',
    minimumIcons: 2_000,
    smokeIcon: 'github',
  },
  {
    name: 'Dashboard Icons',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@main/tree.json',
    minimumIcons: 1_000,
    smokeIcon: 'github.svg',
  },
];

const attempts = 3;
const timeoutMilliseconds = 15_000;

async function fetchJson(provider) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(provider.url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(attempt * 1_000);
      }
    }
  }

  throw new Error(
    `${provider.name} did not respond after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function getStringArray(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string')
    : [];
}

function inspectIconify(provider, data) {
  if (!data || typeof data !== 'object' || data.prefix !== provider.expectedPrefix) {
    throw new Error(`${provider.name} returned an unexpected catalog prefix.`);
  }

  const categories =
    data.categories && typeof data.categories === 'object'
      ? Object.values(data.categories).flatMap(getStringArray)
      : [];
  const icons = new Set([...getStringArray(data.uncategorized), ...categories]);

  if (
    typeof data.total !== 'number' ||
    icons.size < provider.minimumIcons ||
    !icons.has(provider.smokeIcon)
  ) {
    throw new Error(
      `${provider.name} returned an incomplete catalog (${icons.size} usable icons).`,
    );
  }

  return { provider: provider.name, icons: icons.size, reported: data.total };
}

function inspectDashboard(provider, data) {
  if (!data || typeof data !== 'object') {
    throw new Error(`${provider.name} returned an invalid catalog.`);
  }

  const icons = getStringArray(data.svg);
  if (icons.length < provider.minimumIcons || !icons.includes(provider.smokeIcon)) {
    throw new Error(
      `${provider.name} returned an incomplete catalog (${icons.length} usable icons).`,
    );
  }

  return { provider: provider.name, icons: icons.length, reported: null };
}

const results = [];
for (const provider of providers) {
  const data = await fetchJson(provider);
  results.push(
    provider.expectedPrefix
      ? inspectIconify(provider, data)
      : inspectDashboard(provider, data),
  );
}

const table = [
  '| Provider | Usable icons | Provider total |',
  '| --- | ---: | ---: |',
  ...results.map(
    ({ provider, icons, reported }) =>
      `| ${provider} | ${icons.toLocaleString('en-US')} | ${
        reported === null ? 'n/a' : reported.toLocaleString('en-US')
      } |`,
  ),
].join('\n');

console.log(`Verified ${results.length} icon provider catalogs.\n${table}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## Icon provider health\n\n${table}\n`,
  );
}
