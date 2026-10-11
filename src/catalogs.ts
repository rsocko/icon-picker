import type { IconSource } from './types';

export interface IconCategory {
  name: string;
  icons: string[];
}

export interface IconCatalog {
  icons: string[];
  categories: IconCategory[];
}

type IconifyCatalogSource = Extract<IconSource, 'lucide' | 'mdi' | 'ph' | 'si'>;

const ICONIFY_PREFIXES: Record<IconifyCatalogSource, string> = {
  lucide: 'lucide',
  mdi: 'mdi',
  ph: 'ph',
  si: 'simple-icons',
};

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export function parseIconifyCatalog(data: unknown): IconCatalog | null {
  if (typeof data !== 'object' || data === null) return null;

  const record = data as Record<string, unknown>;
  const categories =
    typeof record.categories === 'object' && record.categories !== null
      ? Object.entries(record.categories).flatMap(([name, value]) => {
          const icons = getStringArray(value);
          return icons.length > 0 ? [{ name, icons }] : [];
        })
      : [];
  const icons = Array.from(
    new Set([
      ...getStringArray(record.uncategorized),
      ...categories.flatMap((category) => category.icons),
    ]),
  );

  return icons.length > 0 ? { icons, categories } : null;
}

export async function fetchIconifyCatalog(
  source: IconifyCatalogSource,
  signal: AbortSignal,
): Promise<IconCatalog> {
  const response = await fetch(
    `https://api.iconify.design/collection?prefix=${ICONIFY_PREFIXES[source]}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Iconify catalog returned HTTP ${response.status}.`);
  }

  const catalog = parseIconifyCatalog(await response.json());
  if (!catalog) throw new Error('Iconify catalog returned invalid data.');
  return catalog;
}

export async function fetchDashboardCatalog(
  signal: AbortSignal,
): Promise<IconCatalog> {
  const response = await fetch(
    'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@main/tree.json',
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Dashboard Icons returned HTTP ${response.status}.`);
  }

  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null) {
    throw new Error('Dashboard Icons returned an invalid catalog.');
  }
  const files = getStringArray((data as Record<string, unknown>).svg);
  const icons = files
    .filter((file) => file.endsWith('.svg'))
    .map((file) => file.slice(0, -4))
    .filter((name) => !name.endsWith('-light') && !name.endsWith('-dark'));

  if (icons.length === 0) {
    throw new Error('Dashboard Icons returned an invalid catalog.');
  }
  return { icons, categories: [] };
}
