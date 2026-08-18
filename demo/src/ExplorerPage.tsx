import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  IconRenderer,
  getIconUrl,
  serializeIconValue,
  type IconSource,
  type ParsedIcon,
} from '../../src';
import {
  POPULAR_BY_SOURCE,
  POPULAR_DASHBOARD_ICONS,
  POPULAR_EMOJI,
  POPULAR_SIMPLE_ICONS,
} from '../../src/data';

type CopyFormat = 'name' | 'svg' | 'url' | 'react' | 'css';
type IconSize = 'sm' | 'md' | 'lg';

interface SourceGroup {
  source: IconSource;
  label: string;
  icons: string[];
}

interface SourceFilter {
  id: IconSource;
  label: string;
  marker: string;
  iconifyPrefix?: 'lucide' | 'mdi' | 'ph';
}

interface CopyStatus {
  message: string;
  sequence: number;
}

const SOURCE_FILTERS: readonly SourceFilter[] = [
  { id: 'emoji', label: 'Emoji', marker: '😀' },
  { id: 'lucide', label: 'Lucide', marker: '◇', iconifyPrefix: 'lucide' },
  { id: 'mdi', label: 'MDI', marker: '⬡', iconifyPrefix: 'mdi' },
  { id: 'ph', label: 'Phosphor', marker: '◈', iconifyPrefix: 'ph' },
  { id: 'dash', label: 'Dashboard', marker: '⊞' },
  { id: 'si', label: 'Simple Icons', marker: '◎' },
];

const COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Rose', value: '#f43f5e' },
] as const;

const COPY_FORMATS: readonly { id: CopyFormat; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'svg', label: 'SVG' },
  { id: 'url', label: 'URL' },
  { id: 'react', label: 'React' },
  { id: 'css', label: 'CSS' },
];

const ICON_SIZES: Record<IconSize, { tile: number; icon: number }> = {
  sm: { tile: 66, icon: 28 },
  md: { tile: 86, icon: 40 },
  lg: { tile: 108, icon: 54 },
};

const EXTENDED_EMOJI = [
  ...POPULAR_EMOJI,
  '❤️',
  '🌈',
  '🎉',
  '✨',
  '🍕',
  '🌸',
  '🐱',
  '🦊',
];

const SIMPLE_ICON_SLUG_REPLACEMENTS: Readonly<Record<string, string>> = {
  '+': 'plus',
  '.': 'dot',
  '&': 'and',
  đ: 'd',
  ħ: 'h',
  ı: 'i',
  ĸ: 'k',
  ŀ: 'l',
  ł: 'l',
  ß: 'ss',
  ŧ: 't',
  ø: 'o',
};

let emojiLibraryPromise: Promise<typeof import('emojilib')> | null = null;
const searchCache = new Map<string, string[]>();

function getArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? (value as unknown[]) : null;
}

function getArrayProperty(value: unknown, key: string): unknown[] | null {
  if (typeof value !== 'object' || value === null) return null;
  const property: unknown = (value as Record<string, unknown>)[key];
  return getArray(property);
}

function simpleIconTitleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(
      /[+.&đħıĸŀłßŧø]/g,
      (character) => SIMPLE_ICON_SLUG_REPLACEMENTS[character] ?? character,
    )
    .normalize('NFD')
    .replace(/[^a-z\d]/g, '');
}

async function searchEmoji(query: string, limit: number): Promise<string[]> {
  emojiLibraryPromise ??= import('emojilib');
  const { default: emojiLibrary } = await emojiLibraryPromise;
  const normalized = query.toLowerCase();
  const matches: string[] = [];
  for (const [emoji, keywords] of Object.entries(emojiLibrary)) {
    if (matches.length >= limit) break;
    if (keywords.some((keyword) => keyword.includes(normalized))) {
      matches.push(emoji);
    }
  }
  return matches;
}

async function searchIconify(
  query: string,
  prefix: 'lucide' | 'mdi' | 'ph',
  limit: number,
  signal: AbortSignal,
): Promise<string[]> {
  const cacheKey = `${prefix}:${query}:${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(
    `https://api.iconify.design/search?query=${encodeURIComponent(query)}&prefix=${prefix}&limit=${limit}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Iconify search returned HTTP ${response.status}.`);
  }
  const data: unknown = await response.json();
  const icons = getArrayProperty(data, 'icons');
  if (!icons) throw new Error('Iconify search returned invalid data.');

  const names = icons
    .filter((icon): icon is string => typeof icon === 'string')
    .map((icon) => icon.replace(`${prefix}:`, ''));
  if (searchCache.size >= 300) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }
  searchCache.set(cacheKey, names);
  return names;
}

async function loadDashboardIcons(signal: AbortSignal): Promise<string[]> {
  const response = await fetch(
    'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@main/tree.json',
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Dashboard catalog returned HTTP ${response.status}.`);
  }
  const data: unknown = await response.json();
  const files = getArrayProperty(data, 'svg');
  if (!files) throw new Error('Dashboard catalog returned invalid data.');
  return files
    .filter((file): file is string => typeof file === 'string' && file.endsWith('.svg'))
    .map((file) => file.slice(0, -4))
    .filter((name) => !name.endsWith('-light') && !name.endsWith('-dark'));
}

async function loadSimpleIcons(signal: AbortSignal): Promise<string[]> {
  const response = await fetch(
    'https://cdn.jsdelivr.net/npm/simple-icons/_data/simple-icons.json',
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Simple Icons returned HTTP ${response.status}.`);
  }
  const data: unknown = await response.json();
  const icons = getArray(data) ?? getArrayProperty(data, 'icons');
  if (!icons) throw new Error('Simple Icons returned invalid data.');
  return icons.flatMap((icon) => {
    if (typeof icon !== 'object' || icon === null) return [];
    const slug = 'slug' in icon && typeof icon.slug === 'string' ? icon.slug : null;
    const title = 'title' in icon && typeof icon.title === 'string' ? icon.title : null;
    return slug ? [slug] : title ? [simpleIconTitleToSlug(title)] : [];
  });
}

async function getCopyValue(
  source: IconSource,
  name: string,
  format: CopyFormat,
  color: string,
): Promise<string> {
  const parsed: ParsedIcon = { source, name };
  const serialized = serializeIconValue(parsed);
  const url = getIconUrl(parsed, color);

  switch (format) {
    case 'name':
      return serialized;
    case 'url':
      return url ?? serialized;
    case 'svg': {
      if (!url) return serialized;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`SVG provider returned HTTP ${response.status}.`);
      }
      const svg = await response.text();
      if (
        svg.length > 200_000 ||
        !/^\s*(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(svg)
      ) {
        throw new Error('SVG provider returned invalid data.');
      }
      return svg;
    }
    case 'react':
      if (source === 'emoji') {
        return `<span role="img" aria-label="${name}">${name}</span>`;
      }
      return `<IconRenderer value="${serialized}" size={24} color="${color}" />`;
    case 'css':
      return url ? `background-image: url('${url}');` : serialized;
  }
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function ExplorerPage() {
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<IconSource>>(new Set());
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [dashboardIcons, setDashboardIcons] = useState<string[]>([]);
  const [simpleIcons, setSimpleIcons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [customColor, setCustomColor] = useState('');
  const [copyFormat, setCopyFormat] = useState<CopyFormat>('name');
  const [iconSize, setIconSize] = useState<IconSize>('md');
  const [copyStatus, setCopyStatus] = useState<CopyStatus | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copySequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      loadDashboardIcons(controller.signal),
      loadSimpleIcons(controller.signal),
    ]).then(([dashboardResult, simpleResult]) => {
      if (controller.signal.aborted) return;
      if (dashboardResult.status === 'fulfilled') {
        setDashboardIcons(dashboardResult.value);
      }
      if (simpleResult.status === 'fulfilled') {
        setSimpleIcons(simpleResult.value);
      }
      setCatalogError(
        dashboardResult.status === 'rejected' || simpleResult.status === 'rejected',
      );
    });
    return () => controller.abort();
  }, []);

  const updateQuery = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
    setGroups([]);
    setLoading(Boolean(nextQuery.trim()));
    setSearchError(false);
  }, []);

  const toggleFilter = useCallback(
    (source: IconSource) => {
      setActiveFilters((current) => {
        const next = new Set(current);
        if (next.has(source)) next.delete(source);
        else next.add(source);
        return next;
      });
      if (query.trim()) {
        setGroups([]);
        setLoading(true);
        setSearchError(false);
      }
    },
    [query],
  );

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (event.key === 'Escape' && document.activeElement === searchRef.current) {
        updateQuery('');
      }
      const target = event.target;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (!isEditable && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const index = Number.parseInt(event.key, 10) - 1;
        const source = SOURCE_FILTERS[index];
        if (source) {
          event.preventDefault();
          toggleFilter(source.id);
        }
      }
    }
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [toggleFilter, updateQuery]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const activeSources = useMemo(
    () =>
      activeFilters.size === 0
        ? SOURCE_FILTERS
        : SOURCE_FILTERS.filter((source) => activeFilters.has(source.id)),
    [activeFilters],
  );

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setSearchError(false);
      const perSource =
        activeSources.length <= 2 ? 64 : activeSources.length <= 4 ? 48 : 32;
      const lowerQuery = normalizedQuery.toLowerCase();

      const searches = activeSources.map(async (source): Promise<SourceGroup> => {
        if (source.id === 'emoji') {
          return {
            source: 'emoji',
            label: source.label,
            icons: await searchEmoji(normalizedQuery, perSource),
          };
        }
        if (source.iconifyPrefix) {
          return {
            source: source.id,
            label: source.label,
            icons: await searchIconify(
              normalizedQuery,
              source.iconifyPrefix,
              perSource,
              controller.signal,
            ),
          };
        }
        const catalog =
          source.id === 'dash'
            ? dashboardIcons.length > 0
              ? dashboardIcons
              : POPULAR_DASHBOARD_ICONS
            : simpleIcons.length > 0
              ? simpleIcons
              : POPULAR_SIMPLE_ICONS;
        return {
          source: source.id,
          label: source.label,
          icons: catalog
            .filter((name) => name.includes(lowerQuery))
            .slice(0, perSource),
        };
      });

      void Promise.allSettled(searches).then((results) => {
        if (controller.signal.aborted) return;
        setGroups(
          results.flatMap((result) =>
            result.status === 'fulfilled' && result.value.icons.length > 0
              ? [result.value]
              : [],
          ),
        );
        setSearchError(results.some((result) => result.status === 'rejected'));
        setLoading(false);
      });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeSources, dashboardIcons, query, simpleIcons]);

  const defaultGroups = useMemo((): SourceGroup[] => {
    const perSource =
      activeSources.length <= 2 ? 64 : activeSources.length <= 4 ? 48 : 32;
    return activeSources.map((source) => {
      if (source.id === 'emoji') {
        return { source: 'emoji', label: source.label, icons: EXTENDED_EMOJI };
      }
      const icons = POPULAR_BY_SOURCE[source.id];
      return {
        source: source.id,
        label: source.label,
        icons: [...icons.slice(0, perSource)],
      };
    });
  }, [activeSources]);

  const displayedGroups = query.trim() ? groups : defaultGroups;
  const providerError = catalogError || searchError;
  const totalResults = displayedGroups.reduce(
    (count, group) => count + group.icons.length,
    0,
  );
  const size = ICON_SIZES[iconSize];

  async function copyIcon(source: IconSource, name: string) {
    const selectedFormat = copyFormat;
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      const value = await getCopyValue(source, name, selectedFormat, color);
      await navigator.clipboard.writeText(value);
      setCopyStatus({
        message: `Copied ${selectedFormat}`,
        sequence: ++copySequence.current,
      });
      copyTimer.current = setTimeout(() => setCopyStatus(null), 1800);
    } catch {
      setCopyStatus({
        message: 'Copy failed',
        sequence: ++copySequence.current,
      });
      copyTimer.current = setTimeout(() => setCopyStatus(null), 1800);
    }
  }

  function updateCustomColor(nextColor: string) {
    setCustomColor(nextColor);
    if (/^#[a-fA-F0-9]{6}$/.test(nextColor)) {
      setColor(nextColor);
    }
  }

  return (
    <div className="explorer">
      <a className="explorer-skip" href="#results">
        Skip to icon results
      </a>
      <header className="explorer-toolbar">
        <div className="explorer-search-row">
          <a
            className="explorer-brand"
            href={import.meta.env.BASE_URL}
            aria-label="Back to icon picker demo"
          >
            <IconRenderer value="lucide:shapes" size={22} color="#dbeafe" label="" />
          </a>
          <label className="explorer-search">
            <SearchGlyph />
            <span className="sr-only">Search icons</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search icons… (⌘K)"
              autoFocus
            />
            {loading && <span className="explorer-spinner" aria-label="Searching" />}
            {query && !loading && (
              <button type="button" onClick={() => updateQuery('')} aria-label="Clear search">
                ×
              </button>
            )}
          </label>
          <a className="explorer-back" href={import.meta.env.BASE_URL}>
            Guided demo
          </a>
        </div>

        <div className="explorer-controls">
          <div className="control-group source-controls" aria-label="Icon providers">
            <button
              type="button"
              className={activeFilters.size === 0 ? 'active' : undefined}
              onClick={() => {
                if (activeFilters.size === 0) return;
                setActiveFilters(new Set());
                if (query.trim()) {
                  setGroups([]);
                  setLoading(true);
                  setSearchError(false);
                }
              }}
              aria-pressed={activeFilters.size === 0}
            >
              All
            </button>
            {SOURCE_FILTERS.map((source, index) => (
              <button
                key={source.id}
                type="button"
                className={activeFilters.has(source.id) ? 'active' : undefined}
                onClick={() => toggleFilter(source.id)}
                aria-pressed={activeFilters.has(source.id)}
                title={`${source.label} — keyboard ${index + 1}`}
              >
                <span aria-hidden="true">{source.marker}</span> {source.label}
              </button>
            ))}
          </div>

          <span className="control-divider" />

          <div className="control-group color-controls" aria-label="Icon color">
            {COLORS.map((swatch) => (
              <button
                key={swatch.value}
                type="button"
                className={color === swatch.value ? 'color active' : 'color'}
                style={{ backgroundColor: swatch.value }}
                onClick={() => {
                  setColor(swatch.value);
                  setCustomColor('');
                }}
                aria-label={`Use ${swatch.name}`}
                aria-pressed={color === swatch.value}
              />
            ))}
            <input
              value={customColor}
              onChange={(event) => updateCustomColor(event.target.value)}
              placeholder="#hex"
              aria-label="Custom six-digit hex color"
              aria-invalid={
                customColor.length > 0 && !/^#[a-fA-F0-9]{6}$/.test(customColor)
              }
            />
          </div>

          <span className="control-divider" />

          <div className="control-group copy-controls" aria-label="Copy format">
            <span>Copy:</span>
            {COPY_FORMATS.map((format) => (
              <button
                key={format.id}
                type="button"
                className={copyFormat === format.id ? 'active' : undefined}
                onClick={() => setCopyFormat(format.id)}
                aria-pressed={copyFormat === format.id}
              >
                {format.label}
              </button>
            ))}
          </div>

          <span className="control-divider" />

          <div className="control-group size-controls" aria-label="Icon size">
            {(Object.keys(ICON_SIZES) as IconSize[]).map((option) => (
              <button
                key={option}
                type="button"
                className={iconSize === option ? 'active' : undefined}
                onClick={() => setIconSize(option)}
                aria-pressed={iconSize === option}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main id="results" className="explorer-results">
        <div className="results-summary" aria-live="polite">
          <span>
            {query.trim()
              ? `${totalResults} results for “${query}” across ${displayedGroups.length} sources`
              : `Popular icons from ${displayedGroups.length} sources — type to search`}
          </span>
          {providerError && (
            <span className="provider-warning">Some remote providers are unavailable.</span>
          )}
        </div>

        {loading && displayedGroups.length === 0 ? (
          <div className="explorer-state" role="status">
            <span className="explorer-spinner" /> Searching providers…
          </div>
        ) : displayedGroups.length === 0 && query.trim() ? (
          <div className="explorer-state">No results for “{query}”.</div>
        ) : (
          displayedGroups.map((group) => (
            <section className="explorer-group" key={group.source}>
              <div className="explorer-group-heading">
                <h2>{group.label}</h2>
                <span>{group.icons.length}</span>
              </div>
              <div
                className="explorer-grid"
                style={{ '--tile-min': `${size.tile}px` } as CSSProperties}
              >
                {group.icons.map((name) => {
                  const value = serializeIconValue({ source: group.source, name });
                  return (
                    <button
                      key={value}
                      type="button"
                      className="explorer-tile"
                      onClick={() => void copyIcon(group.source, name)}
                      aria-label={`Copy ${value} as ${copyFormat}`}
                      title={value}
                    >
                      <span
                        className="explorer-icon"
                        style={{ width: size.icon, height: size.icon }}
                      >
                        <IconRenderer
                          value={value}
                          size={size.icon * 0.82}
                          color={group.source === 'dash' ? undefined : color}
                          label=""
                          fallback={<span className="tile-fallback">!</span>}
                        />
                      </span>
                      <code>{name}</code>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="explorer-footer">
        <span>Client-side data from Iconify, jsDelivr, and Simple Icons.</span>
        <span>Click an icon to copy · ⌘/Ctrl+K searches · 1–6 filter providers</span>
      </footer>

      {copyStatus && (
        <div
          key={copyStatus.sequence}
          className="copy-toast"
          role="status"
          aria-live="polite"
        >
          {copyStatus.message}
        </div>
      )}
    </div>
  );
}
