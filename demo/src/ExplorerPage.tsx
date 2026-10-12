import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  copyIconPng,
  downloadIcon,
  getIconReactCode,
  getIconSvg,
  IconRenderer,
  getIconUrl,
  serializeIconValue,
  type IconSource,
  type ParsedIcon,
} from '../../src';
import {
  fetchDashboardCatalog,
  fetchIconifyCatalog,
  type IconCatalog,
} from '../../src/catalogs';
import {
  POPULAR_BY_SOURCE,
  POPULAR_DASHBOARD_ICONS,
  POPULAR_EMOJI,
  POPULAR_SIMPLE_ICONS,
} from '../../src/data';
import { iconMaskCacheKey, loadIconifyMasks } from '../../src/iconify';

type CopyFormat = 'name' | 'svg' | 'url' | 'react' | 'css';
type IconSize = 'sm' | 'md' | 'lg';
type IconAction =
  | 'copy-name'
  | 'copy-svg'
  | 'copy-image'
  | 'copy-url'
  | 'download-svg'
  | 'download-png'
  | 'export';

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
  kind: 'success' | 'error';
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

async function getCopyValue(
  source: IconSource,
  name: string,
  format: CopyFormat,
  color: string,
  signal: AbortSignal,
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
      return source === 'emoji'
        ? serialized
        : getIconSvg(parsed, color, signal);
    }
    case 'react':
      return getIconReactCode(parsed, color);
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

function MoreGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ExplorerTile({
  source,
  name,
  size,
  color,
  copyFormat,
  maskUrl,
  onCopy,
  onAction,
  imageClipboardSupported,
}: {
  source: IconSource;
  name: string;
  size: { tile: number; icon: number };
  color: string;
  copyFormat: CopyFormat;
  maskUrl: string | null | undefined;
  onCopy: () => void;
  onAction: (icon: ParsedIcon, action: IconAction) => void;
  imageClipboardSupported: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const shellRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const value = serializeIconValue({ source, name });
  const icon = useMemo(() => ({ source, name }), [name, source]);
  const isIconifyIcon = source === 'lucide' || source === 'mdi' || source === 'ph';
  const supportsVector = source !== 'emoji';

  useEffect(() => {
    if (!menuOpen) return;
    function closeMenu(event: PointerEvent) {
      if (!shellRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    const closeOnViewportChange = () => setMenuOpen(false);
    document.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [menuOpen]);

  function openMenu(anchorX?: number, anchorY?: number) {
    const rect = moreRef.current?.getBoundingClientRect();
    const preferredLeft = anchorX ?? rect?.right ?? 8;
    const preferredTop = anchorY ?? rect?.bottom ?? 8;
    const left = Math.min(
      window.innerWidth - 228,
      Math.max(8, preferredLeft - 220),
    );
    const top =
      window.innerHeight - preferredTop >= 310
        ? preferredTop + 6
        : Math.max(8, preferredTop - 300);
    setMenuPosition({ top, left });
    setMenuOpen(true);
  }

  function runAction(action: IconAction) {
    setMenuOpen(false);
    onAction(icon, action);
  }

  return (
    <div
      ref={shellRef}
      className="explorer-tile-shell"
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu(event.clientX, event.clientY);
      }}
    >
      <button
        type="button"
        className="explorer-tile"
        onClick={onCopy}
        onKeyDown={(event) => {
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault();
            openMenu();
          }
        }}
        aria-label={`Copy ${value} as ${copyFormat}`}
        title={value}
      >
        <span
          className="explorer-icon"
          style={{ width: size.icon, height: size.icon }}
        >
          {isIconifyIcon && maskUrl ? (
            <span
              role="img"
              aria-label={value}
              className="explorer-icon-mask"
              style={{
                width: size.icon * 0.82,
                height: size.icon * 0.82,
                backgroundColor: color,
                maskImage: `url("${maskUrl}")`,
                WebkitMaskImage: `url("${maskUrl}")`,
              }}
            />
          ) : isIconifyIcon && maskUrl === undefined ? (
            <span
              className="explorer-icon-placeholder"
              aria-hidden="true"
              style={{ width: size.icon * 0.82, height: size.icon * 0.82 }}
            />
          ) : (
            <IconRenderer
              value={value}
              size={size.icon * 0.82}
              color={source === 'dash' || source === 'si' ? undefined : color}
              label=""
              fallback={<span className="tile-fallback">!</span>}
            />
          )}
        </span>
        <code>{name}</code>
      </button>
      <button
        ref={moreRef}
        type="button"
        className="explorer-tile-more"
        aria-label={`More actions for ${value}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          if (menuOpen) setMenuOpen(false);
          else openMenu();
        }}
      >
        <MoreGlyph />
      </button>
      {menuOpen && (
        <div
          className="explorer-action-menu"
          role="menu"
          aria-label={value}
          style={menuPosition}
        >
          <button type="button" role="menuitem" onClick={() => runAction('copy-name')}>
            Copy name
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!supportsVector}
            onClick={() => runAction('copy-svg')}
          >
            Copy SVG
            {!supportsVector && <small>Unavailable for emoji</small>}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!imageClipboardSupported}
            onClick={() => runAction('copy-image')}
          >
            Copy image
            {!imageClipboardSupported && <small>Not supported by this browser</small>}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!supportsVector}
            onClick={() => runAction('copy-url')}
          >
            Copy URL
            {!supportsVector && <small>Unavailable for emoji</small>}
          </button>
          <span className="explorer-action-menu-separator" role="separator" />
          <button
            type="button"
            role="menuitem"
            disabled={!supportsVector}
            onClick={() => runAction('download-svg')}
          >
            Download SVG
          </button>
          <button type="button" role="menuitem" onClick={() => runAction('download-png')}>
            Download PNG
          </button>
          <button
            type="button"
            role="menuitem"
            className="explorer-action-menu-primary"
            onClick={() => runAction('export')}
          >
            Export options…
          </button>
        </div>
      )}
    </div>
  );
}

function ExportPanel({
  icon,
  color,
  imageClipboardSupported,
  onClose,
  onStatus,
}: {
  icon: ParsedIcon;
  color: string;
  imageClipboardSupported: boolean;
  onClose: () => void;
  onStatus: (message: string, kind?: CopyStatus['kind']) => void;
}) {
  const [size, setSize] = useState(128);
  const [padding, setPadding] = useState(12);
  const [background, setBackground] = useState('transparent');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const value = serializeIconValue(icon);
  const supportsVector = icon.source !== 'emoji';
  const url = getIconUrl(icon, color);

  useEffect(() => {
    closeRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  async function runAction(label: string, action: () => Promise<void>) {
    setBusyAction(label);
    try {
      await action();
      onStatus(label);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : `${label} failed.`, 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function copyText(label: string, text: string | Promise<string>) {
    await runAction(label, async () => {
      await navigator.clipboard.writeText(await text);
    });
  }

  const pngOptions = {
    size,
    padding,
    background,
    color,
  };
  const previewBackground =
    background === 'transparent'
      ? undefined
      : background.startsWith('#')
        ? background
        : `#${background}`;

  function updateSize(nextSize: number) {
    setSize(nextSize);
    setPadding((current) =>
      Math.min(current, Math.max(0, Math.floor((nextSize - 1) / 2))),
    );
  }

  return (
    <aside
      className="explorer-export-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="export-panel-title"
    >
      <header>
        <div>
          <span>{icon.source}</span>
          <h2 id="export-panel-title">{icon.name}</h2>
          <code>{value}</code>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="export-panel-close"
          onClick={onClose}
          aria-label="Close export options"
        >
          <CloseGlyph />
        </button>
      </header>

      <div
        className={`export-preview ${
          background === 'transparent' ? 'export-preview-transparent' : ''
        }`}
        style={{ backgroundColor: previewBackground }}
      >
        <IconRenderer
          value={value}
          size={Math.max(32, 112 - padding)}
          color={icon.source === 'dash' ? undefined : color}
          label={value}
        />
      </div>

      <div className="export-panel-settings">
        <fieldset>
          <legend>PNG size</legend>
          <div className="export-choice-row">
            {[32, 64, 128, 256].map((option) => (
              <button
                key={option}
                type="button"
                className={size === option ? 'active' : undefined}
                onClick={() => updateSize(option)}
                aria-pressed={size === option}
              >
                {option}
              </button>
            ))}
            <label>
              <span className="sr-only">Custom PNG size</span>
              <input
                type="number"
                min="16"
                max="2048"
                value={size}
                onChange={(event) =>
                  updateSize(
                    Math.min(2048, Math.max(16, Number(event.target.value))),
                  )
                }
                aria-label="Custom PNG size"
              />
              px
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Background</legend>
          <div className="export-choice-row">
            {([
              ['transparent', 'Transparent'],
              ['#ffffff', 'White'],
              ['#080b12', 'Dark'],
            ] as const).map(([option, label]) => (
              <button
                key={option}
                type="button"
                className={background === option ? 'active' : undefined}
                onClick={() => setBackground(option)}
                aria-pressed={background === option}
              >
                {label}
              </button>
            ))}
            <input
              type="color"
              value={background === 'transparent' ? '#ffffff' : background}
              onChange={(event) => setBackground(event.target.value)}
              aria-label="Custom background color"
            />
          </div>
        </fieldset>
        <label className="export-padding">
          Padding
          <input
            type="range"
            min="0"
            max={Math.max(0, Math.floor(size / 3))}
            value={padding}
            onChange={(event) => setPadding(Number(event.target.value))}
          />
          <output>{padding}px</output>
        </label>
      </div>

      {icon.source === 'emoji' && (
        <p className="export-provider-note">
          Emoji PNG appearance follows this device. Emoji do not have provider SVG files.
        </p>
      )}

      <section className="export-action-group" aria-labelledby="export-copy-heading">
        <h3 id="export-copy-heading">Copy</h3>
        <div>
          <button
            type="button"
            onClick={() => void copyText('Name copied', value)}
            disabled={busyAction !== null}
          >
            Name
          </button>
          <button
            type="button"
            onClick={() => void copyText('SVG copied', getIconSvg(icon, color))}
            disabled={!supportsVector || busyAction !== null}
          >
            SVG
          </button>
          <button
            type="button"
            onClick={() =>
              void runAction('PNG image copied', () => copyIconPng(icon, pngOptions))
            }
            disabled={!imageClipboardSupported || busyAction !== null}
          >
            PNG image
          </button>
          <button
            type="button"
            onClick={() => void copyText('URL copied', url ?? '')}
            disabled={!url || busyAction !== null}
          >
            URL
          </button>
        </div>
      </section>

      <section className="export-action-group" aria-labelledby="export-download-heading">
        <h3 id="export-download-heading">Download</h3>
        <div>
          <button
            type="button"
            onClick={() =>
              void runAction('SVG downloaded', () =>
                downloadIcon(icon, 'svg', { color }),
              )
            }
            disabled={!supportsVector || busyAction !== null}
          >
            SVG
          </button>
          <button
            type="button"
            onClick={() =>
              void runAction('PNG downloaded', () =>
                downloadIcon(icon, 'png', pngOptions),
              )
            }
            disabled={busyAction !== null}
          >
            PNG
          </button>
        </div>
      </section>

      <section className="export-action-group" aria-labelledby="export-code-heading">
        <h3 id="export-code-heading">Code</h3>
        <div>
          <button
            type="button"
            onClick={() =>
              void copyText('React code copied', getIconReactCode(icon, color))
            }
            disabled={busyAction !== null}
          >
            React
          </button>
          <button
            type="button"
            onClick={() =>
              void copyText(
                'CSS copied',
                url ? `background-image: url('${url}');` : value,
              )
            }
            disabled={busyAction !== null}
          >
            CSS
          </button>
          <button
            type="button"
            onClick={() =>
              void copyText(
                'HTML copied',
                url
                  ? `<img src="${url}" alt="${icon.name}" width="${size}" height="${size}" />`
                  : `<span role="img" aria-label="${icon.name}">${icon.name}</span>`,
              )
            }
            disabled={busyAction !== null}
          >
            HTML
          </button>
        </div>
      </section>
    </aside>
  );
}

export function ExplorerPage() {
  const guidedDemoUrl =
    import.meta.env.BASE_URL === '/'
      ? 'https://rsocko.github.io/icon-picker/'
      : import.meta.env.BASE_URL;
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<IconSource>>(new Set());
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [dashboardIcons, setDashboardIcons] = useState<string[]>([]);
  const [simpleIcons, setSimpleIcons] = useState<string[]>([]);
  const [catalogs, setCatalogs] = useState<Partial<Record<IconSource, IconCatalog>>>(
    {},
  );
  const [browseSource, setBrowseSource] = useState<IconSource | null>(null);
  const [browseCategory, setBrowseCategory] = useState('all');
  const [visibleBrowseCount, setVisibleBrowseCount] = useState(96);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [customColor, setCustomColor] = useState('');
  const [copyFormat, setCopyFormat] = useState<CopyFormat>('name');
  const [iconSize, setIconSize] = useState<IconSize>('md');
  const [copyStatus, setCopyStatus] = useState<CopyStatus | null>(null);
  const [exportIcon, setExportIcon] = useState<ParsedIcon | null>(null);
  const [iconMasks, setIconMasks] = useState<Record<string, string | null>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyAnnouncementSequence = useRef(0);
  const copyRequestSequence = useRef(0);
  const browseRequestSequence = useRef(0);
  const copyController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      fetchDashboardCatalog(controller.signal),
      fetchIconifyCatalog('si', controller.signal),
    ]).then(([dashboardResult, simpleResult]) => {
      if (controller.signal.aborted) return;
      if (dashboardResult.status === 'fulfilled') {
        setDashboardIcons(dashboardResult.value.icons);
      }
      if (simpleResult.status === 'fulfilled') {
        setSimpleIcons(simpleResult.value.icons);
      }
      setCatalogs((current) => ({
        ...current,
        ...(dashboardResult.status === 'fulfilled'
          ? { dash: dashboardResult.value }
          : {}),
        ...(simpleResult.status === 'fulfilled'
          ? { si: simpleResult.value }
          : {}),
      }));
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
      setBrowseSource(null);
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
      copyController.current?.abort();
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
  const browsedSource = browseSource
    ? SOURCE_FILTERS.find((source) => source.id === browseSource)
    : undefined;
  const browseCatalog = browseSource ? catalogs[browseSource] : undefined;
  const browseIcons = useMemo(
    () =>
      browseCatalog && browseCategory !== 'all'
        ? browseCatalog.categories.find(
            (category) => category.name === browseCategory,
          )?.icons ?? []
        : browseCatalog?.icons ?? [],
    [browseCatalog, browseCategory],
  );
  const visibleBrowseIcons = useMemo(
    () => browseIcons.slice(0, visibleBrowseCount),
    [browseIcons, visibleBrowseCount],
  );
  const maskGroups = useMemo(
    () =>
      browseSource && !query.trim() && visibleBrowseIcons.length > 0
        ? [
            {
              source: browseSource,
              label: browsedSource?.label ?? browseSource,
              icons: visibleBrowseIcons,
            },
          ]
        : displayedGroups,
    [
      browseSource,
      browsedSource?.label,
      displayedGroups,
      query,
      visibleBrowseIcons,
    ],
  );
  const providerError = catalogError || searchError;
  const imageClipboardSupported =
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function';
  const totalResults = displayedGroups.reduce(
    (count, group) => count + group.icons.length,
    0,
  );
  const size = ICON_SIZES[iconSize];

  useEffect(() => {
    const controller = new AbortController();
    const iconifyGroups = maskGroups.filter((group) =>
      ['lucide', 'mdi', 'ph'].includes(group.source),
    );
    if (iconifyGroups.length === 0) return () => controller.abort();

    void Promise.all(
      iconifyGroups.map((group) =>
        loadIconifyMasks(group.source, group.icons, controller.signal),
      ),
    ).then((loadedMasks) => {
      if (controller.signal.aborted) return;
      setIconMasks((current) =>
        loadedMasks.reduce<Record<string, string | null>>(
          (combined, masks) => ({ ...combined, ...masks }),
          current,
        ),
      );
    });

    return () => controller.abort();
  }, [maskGroups]);

  function showStatus(
    message: string,
    kind: CopyStatus['kind'] = 'success',
  ) {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopyStatus({
      message,
      kind,
      sequence: ++copyAnnouncementSequence.current,
    });
    copyTimer.current = setTimeout(() => setCopyStatus(null), 2400);
  }

  async function runLatestAction(
    action: (
      signal: AbortSignal,
      assertCurrent: () => void,
    ) => Promise<string>,
  ) {
    const requestSequence = ++copyRequestSequence.current;
    copyController.current?.abort();
    const controller = new AbortController();
    copyController.current = controller;
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopyStatus(null);
    const assertCurrent = () => {
      if (
        controller.signal.aborted ||
        requestSequence !== copyRequestSequence.current
      ) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
    };
    try {
      const message = await action(controller.signal, assertCurrent);
      assertCurrent();
      showStatus(message);
    } catch (error) {
      if (
        controller.signal.aborted ||
        requestSequence !== copyRequestSequence.current
      ) {
        return;
      }
      showStatus(
        error instanceof Error ? error.message : 'The icon action failed.',
        'error',
      );
    } finally {
      if (copyController.current === controller) {
        copyController.current = null;
      }
    }
  }

  async function copyIcon(source: IconSource, name: string) {
    const selectedFormat = copyFormat;
    await runLatestAction(async (signal, assertCurrent) => {
      const value = await getCopyValue(
        source,
        name,
        selectedFormat,
        color,
        signal,
      );
      assertCurrent();
      await navigator.clipboard.writeText(value);
      return `Copied ${selectedFormat}`;
    });
  }

  function handleIconAction(icon: ParsedIcon, action: IconAction) {
    if (action === 'export') {
      setExportIcon(icon);
      return;
    }

    void runLatestAction(async (signal, assertCurrent) => {
      const value = serializeIconValue(icon);
      switch (action) {
        case 'copy-name':
          assertCurrent();
          await navigator.clipboard.writeText(value);
          return 'Name copied';
        case 'copy-svg':
          {
            const svg = await getIconSvg(icon, color, signal);
            assertCurrent();
            await navigator.clipboard.writeText(svg);
          }
          return 'SVG copied';
        case 'copy-image':
          await copyIconPng(
            icon,
            { size: 128, padding: 12, background: 'transparent', color },
            signal,
          );
          return 'PNG image copied';
        case 'copy-url': {
          const url = getIconUrl(icon, color);
          if (!url) throw new Error('This icon does not have a provider URL.');
          assertCurrent();
          await navigator.clipboard.writeText(url);
          return 'URL copied';
        }
        case 'download-svg':
          await downloadIcon(icon, 'svg', { color }, signal);
          return 'SVG downloaded';
        case 'download-png':
          await downloadIcon(
            icon,
            'png',
            { size: 128, padding: 12, background: 'transparent', color },
            signal,
          );
          return 'PNG downloaded';
      }
    });
  }

  function updateCustomColor(nextColor: string) {
    setCustomColor(nextColor);
    if (/^#[a-fA-F0-9]{6}$/.test(nextColor)) {
      setColor(nextColor);
    }
  }

  async function browseAll(source: IconSource) {
    const requestSequence = ++browseRequestSequence.current;
    setBrowseSource(source);
    setBrowseCategory('all');
    setVisibleBrowseCount(96);
    setBrowseError(false);
    if (catalogs[source]) {
      setBrowseLoading(false);
      return;
    }

    setBrowseLoading(true);
    try {
      let catalog: IconCatalog;
      if (source === 'emoji') {
        emojiLibraryPromise ??= import('emojilib');
        const { default: emojiLibrary } = await emojiLibraryPromise;
        catalog = { icons: Object.keys(emojiLibrary), categories: [] };
      } else if (source === 'dash') {
        catalog = await fetchDashboardCatalog(new AbortController().signal);
      } else {
        catalog = await fetchIconifyCatalog(source, new AbortController().signal);
      }
      setCatalogs((current) => ({ ...current, [source]: catalog }));
    } catch {
      if (requestSequence === browseRequestSequence.current) {
        setBrowseError(true);
      }
    } finally {
      if (requestSequence === browseRequestSequence.current) {
        setBrowseLoading(false);
      }
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
            href={guidedDemoUrl}
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
          <a className="explorer-back" href={guidedDemoUrl}>
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
                setBrowseSource(null);
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
            <span>Click copies:</span>
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
            {browseSource && !query.trim()
              ? browseError
                ? `${browsedSource?.label ?? browseSource} catalog unavailable`
                : browseCatalog
                ? `${browseIcons.length.toLocaleString()} ${browsedSource?.label ?? browseSource} icons`
                : `Loading ${browsedSource?.label ?? browseSource} icons`
              : query.trim()
              ? `${totalResults} results for “${query}” across ${displayedGroups.length} sources`
              : `Popular icons from ${displayedGroups.length} sources — browse or search`}
          </span>
          {providerError && (
            <span className="provider-warning">Some remote providers are unavailable.</span>
          )}
        </div>

        {browseSource && !query.trim() ? (
          <section
            className="explorer-browser"
            aria-labelledby={`browse-${browseSource}`}
          >
            <div className="explorer-browser-heading">
              <button type="button" onClick={() => setBrowseSource(null)}>
                <span aria-hidden="true">←</span> All providers
              </button>
              <div>
                <h1 id={`browse-${browseSource}`}>
                  {browsedSource?.label ?? browseSource}
                </h1>
                <p>
                  {browseCatalog
                    ? `${browseCatalog.icons.length.toLocaleString()} icons in this provider`
                    : browseError
                      ? 'The remote provider did not return its catalog'
                    : 'Loading the complete provider catalog'}
                </p>
              </div>
            </div>

            {browseCatalog && browseCatalog.categories.length > 0 && (
              <div className="explorer-categories" aria-label="Icon categories">
                <button
                  type="button"
                  className={browseCategory === 'all' ? 'active' : undefined}
                  onClick={() => {
                    setBrowseCategory('all');
                    setVisibleBrowseCount(96);
                  }}
                  aria-pressed={browseCategory === 'all'}
                >
                  All
                </button>
                {browseCatalog.categories.map((category) => (
                  <button
                    key={category.name}
                    type="button"
                    className={browseCategory === category.name ? 'active' : undefined}
                    onClick={() => {
                      setBrowseCategory(category.name);
                      setVisibleBrowseCount(96);
                    }}
                    aria-pressed={browseCategory === category.name}
                  >
                    {category.name}
                    <span>{category.icons.length.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}

            {browseLoading ? (
              <div className="explorer-state" role="status">
                <span className="explorer-spinner" /> Loading catalog…
              </div>
            ) : browseError || !browseCatalog ? (
              <div className="explorer-state explorer-state-column">
                <strong>Could not load this provider’s catalog.</strong>
                <button type="button" onClick={() => void browseAll(browseSource)}>
                  Try again
                </button>
              </div>
            ) : (
              <>
                <div
                  className="explorer-grid"
                  style={{ '--tile-min': `${size.tile}px` } as CSSProperties}
                >
                  {visibleBrowseIcons.map((name) => (
                    <ExplorerTile
                      key={`${browseSource}:${name}`}
                      source={browseSource}
                      name={name}
                      size={size}
                      color={color}
                      copyFormat={copyFormat}
                      maskUrl={iconMasks[iconMaskCacheKey(browseSource, name)]}
                      onCopy={() => void copyIcon(browseSource, name)}
                      onAction={handleIconAction}
                      imageClipboardSupported={imageClipboardSupported}
                    />
                  ))}
                </div>
                {visibleBrowseCount < browseIcons.length && (
                  <div className="explorer-load-more">
                    <button
                      type="button"
                      onClick={() => setVisibleBrowseCount((count) => count + 96)}
                    >
                      Load 96 more
                    </button>
                    <span>
                      Showing {visibleBrowseIcons.length.toLocaleString()} of{' '}
                      {browseIcons.length.toLocaleString()}
                    </span>
                  </div>
                )}
              </>
            )}
          </section>
        ) : loading && displayedGroups.length === 0 ? (
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
                {!query.trim() && (
                  <button type="button" onClick={() => void browseAll(group.source)}>
                    Browse all
                  </button>
                )}
              </div>
              <div
                className="explorer-grid"
                style={{ '--tile-min': `${size.tile}px` } as CSSProperties}
              >
                {group.icons.map((name) => (
                  <ExplorerTile
                    key={`${group.source}:${name}`}
                    source={group.source}
                    name={name}
                    size={size}
                    color={color}
                    copyFormat={copyFormat}
                    maskUrl={iconMasks[iconMaskCacheKey(group.source, name)]}
                    onCopy={() => void copyIcon(group.source, name)}
                    onAction={handleIconAction}
                    imageClipboardSupported={imageClipboardSupported}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="explorer-footer">
        <span>Client-side data from Iconify, jsDelivr, and Simple Icons.</span>
        <span>
          Click to copy · More actions exports · ⌘/Ctrl+K searches · 1–6 filter
          providers
        </span>
      </footer>

      {exportIcon && (
        <ExportPanel
          key={serializeIconValue(exportIcon)}
          icon={exportIcon}
          color={color}
          imageClipboardSupported={imageClipboardSupported}
          onClose={() => setExportIcon(null)}
          onStatus={showStatus}
        />
      )}

      {copyStatus && (
        <div
          key={copyStatus.sequence}
          className={`copy-toast copy-toast-${copyStatus.kind}`}
          role="status"
          aria-live="polite"
        >
          {copyStatus.message}
        </div>
      )}
    </div>
  );
}
