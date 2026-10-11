import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { EmojiClickData, Theme } from 'emoji-picker-react';
import {
  fetchDashboardCatalog,
  fetchIconifyCatalog,
  type IconCatalog,
} from './catalogs';
import { cx } from './classnames';
import {
  getIconUrl,
  parseIconValue,
  serializeIconValue,
} from './core';
import {
  ICON_COLORS,
  POPULAR_BY_SOURCE,
  POPULAR_DASHBOARD_ICONS,
  POPULAR_EMOJI,
  POPULAR_SIMPLE_ICONS,
  SOURCE_FILTERS,
} from './data';
import { iconMaskCacheKey, loadIconifyMasks } from './iconify';
import { IconRenderer } from './IconRenderer';
import { useResolvedIconPickerTheme } from './theme';
import type { IconPickerProps, IconSource, ParsedIcon } from './types';

const EmojiBrowser = lazy(() => import('emoji-picker-react'));
let emojiLibraryPromise: Promise<typeof import('emojilib')> | null = null;
const iconifySearchCache = new Map<string, string[]>();
const MAX_CACHE_SIZE = 200;

interface SourceGroup {
  source: IconSource;
  label: string;
  icons: string[];
}

function getArrayProperty(value: unknown, key: string): unknown[] | null {
  if (typeof value !== 'object' || value === null) return null;
  const property: unknown = (value as Record<string, unknown>)[key];
  return Array.isArray(property) ? property : null;
}

function getArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? (value as unknown[]) : null;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="rs-icon-picker__svg">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="rs-icon-picker__svg">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function Spinner() {
  return <span className="rs-icon-picker__spinner" aria-hidden="true" />;
}

async function searchEmoji(query: string, limit: number): Promise<string[]> {
  emojiLibraryPromise ??= import('emojilib');
  const { default: emojiLibrary } = await emojiLibraryPromise;
  const normalizedQuery = query.toLowerCase();
  const results: string[] = [];

  for (const [emoji, keywords] of Object.entries(emojiLibrary)) {
    if (results.length >= limit) break;
    if (keywords.some((keyword) => keyword.includes(normalizedQuery))) {
      results.push(emoji);
    }
  }

  return results;
}

async function searchIconify(
  query: string,
  prefix: 'lucide' | 'mdi' | 'ph',
  limit: number,
  signal: AbortSignal,
): Promise<string[]> {
  const cacheKey = `${prefix}:${query}:${limit}`;
  const cached = iconifySearchCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(
    `https://api.iconify.design/search?query=${encodeURIComponent(query)}&prefix=${prefix}&limit=${limit}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Iconify search returned HTTP ${response.status}.`);
  }

  const data: unknown = await response.json();
  const icons = getArray(data) ?? getArrayProperty(data, 'icons');
  if (!icons) {
    throw new Error('Iconify search returned an invalid response.');
  }

  const names = icons
    .filter((icon): icon is string => typeof icon === 'string')
    .map((icon) => icon.replace(`${prefix}:`, ''));

  if (iconifySearchCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = iconifySearchCache.keys().next().value;
    if (oldestKey) iconifySearchCache.delete(oldestKey);
  }
  iconifySearchCache.set(cacheKey, names);
  return names;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('hidden'));
}

export const IconPicker = memo(function IconPicker({
  value,
  onChange,
  onClose,
  color,
  onColorChange,
  className,
  id,
  ariaLabel = 'Choose an icon',
  searchDebounceMs = 200,
  modal = false,
  theme = 'auto',
  style,
}: IconPickerProps) {
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const resolvedTheme = useResolvedIconPickerTheme(theme, rootElement);
  const setRoot = useCallback((element: HTMLDivElement | null) => {
    rootRef.current = element;
    setRootElement(element);
  }, []);
  const searchRequestId = useRef(0);
  const browseRequestId = useRef(0);
  const generatedId = useId();
  const pickerId = id ?? `rs-icon-picker-${generatedId.replace(/:/g, '')}`;
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<IconSource>>(new Set());
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [catalogWarning, setCatalogWarning] = useState(false);
  const [dashboardIcons, setDashboardIcons] = useState<string[]>([]);
  const [simpleIcons, setSimpleIcons] = useState<string[]>([]);
  const [catalogs, setCatalogs] = useState<
    Partial<Record<Exclude<IconSource, 'emoji'>, IconCatalog>>
  >({});
  const [browseSource, setBrowseSource] = useState<
    Exclude<IconSource, 'emoji'> | null
  >(null);
  const [browseCategory, setBrowseCategory] = useState('all');
  const [visibleBrowseCount, setVisibleBrowseCount] = useState(96);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(false);
  const [showEmojiBrowser, setShowEmojiBrowser] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [iconMasks, setIconMasks] = useState<Record<string, string | null>>({});

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
      setCatalogWarning(
        dashboardResult.status === 'rejected' || simpleResult.status === 'rejected',
      );
    });

    return () => controller.abort();
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
    const requestId = ++searchRequestId.current;
    if (!normalizedQuery) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setSearchError(null);
      const perSource =
        activeSources.length <= 2 ? 48 : activeSources.length <= 4 ? 32 : 24;
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
        if (controller.signal.aborted || requestId !== searchRequestId.current) return;

        const successfulGroups = results.flatMap((result) =>
          result.status === 'fulfilled' && result.value.icons.length > 0
            ? [result.value]
            : [],
        );
        const failureCount = results.filter((result) => result.status === 'rejected').length;
        setSourceGroups(successfulGroups);
        setSearchError(
          failureCount > 0
            ? `${failureCount === 1 ? 'One provider is' : 'Some providers are'} temporarily unavailable.`
            : null,
        );
        setLoading(false);
      });
    }, Math.max(0, searchDebounceMs));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    activeSources,
    dashboardIcons,
    query,
    retryCount,
    searchDebounceMs,
    simpleIcons,
  ]);

  const defaultGroups = useMemo((): SourceGroup[] => {
    const perSource =
      activeSources.length <= 2 ? 48 : activeSources.length <= 4 ? 32 : 24;
    return activeSources.map((source) => {
      if (source.id === 'emoji') {
        return { source: 'emoji', label: source.label, icons: POPULAR_EMOJI };
      }
      const icons =
        source.id === 'dash' && dashboardIcons.length > 0
          ? dashboardIcons
          : source.id === 'si' && simpleIcons.length > 0
            ? simpleIcons
            : POPULAR_BY_SOURCE[source.id];
      return {
        source: source.id,
        label: source.label,
        icons: [...icons.slice(0, perSource)],
      };
    });
  }, [activeSources, dashboardIcons, simpleIcons]);

  const selectedIcon = parseIconValue(value);
  const isSearching = query.trim().length > 0;
  const displayedGroups = isSearching ? sourceGroups : defaultGroups;
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
      browseSource && !isSearching && visibleBrowseIcons.length > 0
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
      isSearching,
      visibleBrowseIcons,
    ],
  );
  const resultCount = displayedGroups.reduce(
    (total, group) => total + group.icons.length,
    0,
  );

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
    ).then((groups) => {
      if (controller.signal.aborted) return;
      setIconMasks((current) =>
        groups.reduce<Record<string, string | null>>(
          (combined, group) => ({ ...combined, ...group }),
          current,
        ),
      );
    });

    return () => controller.abort();
  }, [maskGroups]);

  function toggleFilter(source: IconSource) {
    setBrowseSource(null);
    setShowEmojiBrowser(false);
    setActiveFilters((current) => {
      const next = new Set(current);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setShowEmojiBrowser(false);
    if (!nextQuery.trim()) {
      setSourceGroups([]);
      setLoading(false);
      setSearchError(null);
    }
  }

  function selectIcon(source: IconSource, name: string) {
    onChange(serializeIconValue({ source, name }));
  }

  async function browseAll(source: IconSource) {
    const requestId = ++browseRequestId.current;
    setBrowseCategory('all');
    setVisibleBrowseCount(96);
    setBrowseError(false);
    if (source === 'emoji') {
      setShowEmojiBrowser(true);
      setBrowseSource(null);
      return;
    }

    setShowEmojiBrowser(false);
    setBrowseSource(source);
    if (catalogs[source]) {
      setBrowseLoading(false);
      return;
    }

    const controller = new AbortController();
    setBrowseLoading(true);
    try {
      const catalog =
        source === 'dash'
          ? await fetchDashboardCatalog(controller.signal)
          : await fetchIconifyCatalog(source, controller.signal);
      setCatalogs((current) => ({ ...current, [source]: catalog }));
    } catch {
      if (requestId === browseRequestId.current) setBrowseError(true);
    } finally {
      if (requestId === browseRequestId.current) setBrowseLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && onClose) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (!modal || event.key !== 'Tab' || !rootRef.current) return;

    const focusable = getFocusableElements(rootRef.current);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={setRoot}
      id={pickerId}
      className={cx('rs-icon-picker', className)}
      data-rs-icon-picker-theme={resolvedTheme}
      style={style}
      role={modal ? 'dialog' : 'region'}
      aria-modal={modal || undefined}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      <div className="rs-icon-picker__search">
        <SearchIcon />
        <input
          type="search"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="Search emoji, icons, brands..."
          aria-label="Search icons"
          autoFocus={modal}
        />
        {loading && <Spinner />}
        {query && !loading && (
          <button
            type="button"
            className="rs-icon-picker__icon-button"
            onClick={() => updateQuery('')}
            aria-label="Clear search"
          >
            <CloseIcon />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            className="rs-icon-picker__icon-button"
            onClick={onClose}
            aria-label="Close icon picker"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div
        className="rs-icon-picker__filters"
        role="group"
        aria-label="Icon sources"
      >
        {SOURCE_FILTERS.map((source) => {
          const active = activeFilters.size === 0 || activeFilters.has(source.id);
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => toggleFilter(source.id)}
              className={cx(
                'rs-icon-picker__filter',
                active && 'rs-icon-picker__filter--active',
              )}
              aria-pressed={active}
            >
              {source.label}
            </button>
          );
        })}
      </div>

      {onColorChange && (
        <div className="rs-icon-picker__colors" aria-label="Icon color">
          <span>Color</span>
          <div className="rs-icon-picker__color-options">
            <button
              type="button"
              onClick={() => onColorChange('')}
              className={cx(
                'rs-icon-picker__auto-color',
                !color && 'rs-icon-picker__auto-color--selected',
              )}
              aria-label="Use theme color"
              aria-pressed={!color}
            >
              Auto
            </button>
            {ICON_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => onColorChange(swatch)}
                className={cx(
                  'rs-icon-picker__color',
                  color === swatch && 'rs-icon-picker__color--selected',
                )}
                style={{ backgroundColor: swatch }}
                aria-label={`Set icon color to ${swatch}`}
                aria-pressed={color === swatch}
              />
            ))}
          </div>
        </div>
      )}

      <div className="rs-icon-picker__results">
        {showEmojiBrowser && !isSearching ? (
          <>
            <button
              type="button"
              className="rs-icon-picker__back"
              onClick={() => setShowEmojiBrowser(false)}
            >
              Back to all icons
            </button>
            <Suspense
              fallback={
                <div className="rs-icon-picker__state" role="status">
                  <Spinner /> Loading emoji...
                </div>
              }
            >
              <EmojiBrowser
                onEmojiClick={(emojiData: EmojiClickData) =>
                  selectIcon('emoji', emojiData.emoji)
                }
                autoFocusSearch={false}
                theme={resolvedTheme as Theme}
                height={400}
                width="100%"
                searchPlaceHolder="Search emoji..."
                previewConfig={{ showPreview: false }}
              />
            </Suspense>
          </>
        ) : browseSource && !isSearching ? (
          <section
            className="rs-icon-picker__browser"
            aria-labelledby={`${pickerId}-browse-${browseSource}`}
          >
            <div className="rs-icon-picker__browser-heading">
              <button
                type="button"
                className="rs-icon-picker__back"
                onClick={() => setBrowseSource(null)}
              >
                Back
              </button>
              <div>
                <h2 id={`${pickerId}-browse-${browseSource}`}>
                  {browsedSource?.label ?? browseSource}
                </h2>
                {browseCatalog && (
                  <span>{browseIcons.length.toLocaleString()} icons</span>
                )}
              </div>
            </div>

            {browseCatalog && browseCatalog.categories.length > 0 && (
              <div className="rs-icon-picker__categories" aria-label="Icon categories">
                <button
                  type="button"
                  className={cx(
                    'rs-icon-picker__category',
                    browseCategory === 'all' && 'rs-icon-picker__category--active',
                  )}
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
                    className={cx(
                      'rs-icon-picker__category',
                      browseCategory === category.name &&
                        'rs-icon-picker__category--active',
                    )}
                    onClick={() => {
                      setBrowseCategory(category.name);
                      setVisibleBrowseCount(96);
                    }}
                    aria-pressed={browseCategory === category.name}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            )}

            {browseLoading ? (
              <div className="rs-icon-picker__state" role="status">
                <Spinner /> Loading {browsedSource?.label ?? 'icons'}...
              </div>
            ) : browseError || !browseCatalog ? (
              <div className="rs-icon-picker__state">
                <span>Could not load this catalog.</span>
                <button type="button" onClick={() => void browseAll(browseSource)}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="rs-icon-picker__grid">
                  {visibleBrowseIcons.map((name) => (
                    <IconGridItem
                      key={`${browseSource}:${name}`}
                      name={name}
                      source={browseSource}
                      color={
                        browseSource === 'dash' || browseSource === 'si'
                          ? undefined
                          : color
                      }
                      maskUrl={iconMasks[iconMaskCacheKey(browseSource, name)]}
                      selected={
                        selectedIcon?.source === browseSource &&
                        selectedIcon.name === name
                      }
                      onClick={() => selectIcon(browseSource, name)}
                    />
                  ))}
                </div>
                {visibleBrowseCount < browseIcons.length && (
                  <div className="rs-icon-picker__load-more">
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
          <div className="rs-icon-picker__state" role="status">
            <Spinner /> Searching...
          </div>
        ) : displayedGroups.length === 0 && isSearching ? (
          <div className="rs-icon-picker__state">
            <span>No results for &quot;{query}&quot;.</span>
            {searchError && (
              <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
                Retry providers
              </button>
            )}
          </div>
        ) : (
          displayedGroups.map((group) => (
            <section
              key={group.source}
              className="rs-icon-picker__group"
              aria-labelledby={`${pickerId}-${group.source}`}
            >
              <div className="rs-icon-picker__group-heading">
                <h2 id={`${pickerId}-${group.source}`}>{group.label}</h2>
                <span>{group.icons.length}</span>
                {!isSearching && (
                  <button type="button" onClick={() => void browseAll(group.source)}>
                    Browse all
                  </button>
                )}
              </div>
              <div
                className={cx(
                  'rs-icon-picker__grid',
                  group.source === 'emoji' && 'rs-icon-picker__grid--emoji',
                )}
              >
                {group.icons.map((name) =>
                  group.source === 'emoji' ? (
                    <button
                      key={name}
                      type="button"
                      onClick={() => selectIcon('emoji', name)}
                      className="rs-icon-picker__emoji"
                      aria-label={`Select emoji ${name}`}
                      aria-pressed={
                        selectedIcon?.source === 'emoji' && selectedIcon.name === name
                      }
                    >
                      {name}
                    </button>
                  ) : (
                    <IconGridItem
                      key={`${group.source}:${name}`}
                      name={name}
                      source={group.source}
                      color={
                        group.source === 'dash' || group.source === 'si'
                          ? undefined
                          : color
                      }
                      maskUrl={iconMasks[iconMaskCacheKey(group.source, name)]}
                      selected={
                        selectedIcon?.source === group.source &&
                        selectedIcon.name === name
                      }
                      onClick={() => selectIcon(group.source, name)}
                    />
                  ),
                )}
              </div>
            </section>
          ))
        )}
      </div>

      <div className="rs-icon-picker__announcer" aria-live="polite">
        {isSearching && !loading
          ? `${resultCount} icon${resultCount === 1 ? '' : 's'} found.`
          : ''}
      </div>
      {(searchError || catalogWarning) && (
        <div className="rs-icon-picker__notice" role="alert">
          {searchError ?? 'Live brand catalogs are unavailable; showing built-in icons.'}
        </div>
      )}
    </div>
  );
});

const IconGridItem = memo(function IconGridItem({
  name,
  source,
  color,
  selected,
  maskUrl,
  onClick,
}: {
  name: string;
  source: Exclude<IconSource, 'emoji'>;
  color?: string | undefined;
  selected: boolean;
  maskUrl?: string | null | undefined;
  onClick: () => void;
}) {
  const parsed: ParsedIcon = { source, name };
  const url = getIconUrl(parsed, color);
  const value = serializeIconValue(parsed);
  const isIconifyIcon =
    source === 'lucide' || source === 'mdi' || source === 'ph';

  return (
    <button
      type="button"
      onClick={onClick}
      className="rs-icon-picker__grid-item"
      aria-label={`Select ${value}`}
      aria-pressed={selected}
      title={value}
    >
      {isIconifyIcon && maskUrl ? (
        <span
          role="img"
          aria-label={value}
          className="rs-icon-picker__grid-mask"
          style={{
            backgroundColor: color || 'currentColor',
            maskImage: `url("${maskUrl}")`,
            WebkitMaskImage: `url("${maskUrl}")`,
          }}
        />
      ) : isIconifyIcon && maskUrl === undefined ? (
        <span className="rs-icon-picker__grid-placeholder" aria-hidden="true" />
      ) : isIconifyIcon ? (
        <IconRenderer
          value={value}
          size={22}
          color={color}
          label=""
          fallback={
            <span className="rs-icon-picker__broken-icon" aria-hidden="true">
              !
            </span>
          }
        />
      ) : url ? (
        <img
          src={url}
          alt=""
          width={22}
          height={22}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="rs-icon-picker__broken-icon" aria-hidden="true">
          !
        </span>
      )}
      <span>{name.length > 10 ? `${name.slice(0, 10)}...` : name}</span>
    </button>
  );
});
