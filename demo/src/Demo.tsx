import { useEffect, useMemo, useState } from 'react';
import {
  IconPicker,
  IconPickerButton,
  IconRenderer,
  getIconUrl,
  parseIconValue,
  serializeIconValue,
} from '../../src';

const PROVIDERS = [
  {
    name: 'Emoji',
    value: '🚀',
    description: 'Native and local',
    accent: '#f59e0b',
  },
  {
    name: 'Lucide',
    value: 'lucide:rocket',
    description: 'Iconify delivery',
    accent: '#60a5fa',
  },
  {
    name: 'Material',
    value: 'mdi:home-variant',
    description: 'Iconify delivery',
    accent: '#38bdf8',
  },
  {
    name: 'Phosphor',
    value: 'ph:star-four',
    description: 'Iconify delivery',
    accent: '#c084fc',
  },
  {
    name: 'Dashboard',
    value: 'dash:home-assistant',
    description: 'jsDelivr delivery',
    accent: '#2dd4bf',
  },
  {
    name: 'Simple Icons',
    value: 'si:github',
    description: 'Simple Icons CDN',
    accent: '#f8fafc',
  },
] as const;

const COLORS = [
  '#ffffff',
  '#94a3b8',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
] as const;

const STORAGE_EXAMPLES = [
  '🚀',
  'lucide:rocket',
  'mdi:home',
  'ph:star',
  'dash:nextcloud',
  'si:github',
  'rocket',
] as const;

function useNetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

export function Demo() {
  const [selectedIcon, setSelectedIcon] = useState<string | null>('lucide:rocket');
  const [color, setColor] = useState('#60a5fa');
  const online = useNetworkStatus();
  const parsed = useMemo(() => parseIconValue(selectedIcon), [selectedIcon]);
  const serialized = parsed ? serializeIconValue(parsed) : 'No icon selected';

  return (
    <div className="demo-app">
      <a className="skip-link" href="#playground">
        Skip to interactive demo
      </a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Icon picker demo home">
          <span className="brand-mark" aria-hidden="true">
            <IconRenderer value="lucide:shapes" size={24} color="#f8fafc" />
          </span>
          <span>@rsocko/icon-picker</span>
        </a>
        <nav aria-label="Demo sections">
          <a href="#playground">Playground</a>
          <a href="#providers">Providers</a>
          <a href="#contract">Contract</a>
          <a href="#network">Network</a>
        </nav>
        <a
          className="github-link"
          href="https://github.com/rsocko/icon-picker"
          rel="noreferrer"
        >
          View source
        </a>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="pulse-dot" />
              Static React demo · no backend
            </div>
            <h1 id="hero-title">
              One picker.
              <span> Six icon worlds.</span>
            </h1>
            <p>
              Search, select, store, and render portable icon values across emoji
              and five open icon providers. Framework-neutral, accessible, and
              safe to server render.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#playground">
                Try the picker
              </a>
              <a className="secondary-action" href={`${import.meta.env.BASE_URL}explorer/`}>
                Open full explorer
              </a>
              <span className="install-command">
                <code>npm i @rsocko/icon-picker@next</code>
                <small>after the prerelease is published</small>
              </span>
            </div>
            <div className="feature-row" aria-label="Package characteristics">
              <span>React 18–19</span>
              <span>ESM + types</span>
              <span>SSR-safe</span>
              <span>MIT</span>
            </div>
          </div>

          <div className="hero-preview" aria-label="Selected icon preview">
            <div className="preview-glow" style={{ backgroundColor: color }} />
            <div className="preview-icon">
              <IconRenderer
                value={selectedIcon}
                size={92}
                color={color}
                fallback={<span className="fallback-glyph">?</span>}
              />
            </div>
            <div className="preview-meta">
              <span>Portable value</span>
              <output data-testid="selected-value">{serialized}</output>
            </div>
          </div>
        </section>

        <section
          className="section playground-section"
          id="playground"
          aria-labelledby="playground-title"
        >
          <div className="section-heading">
            <div>
              <span className="section-number">01</span>
              <h2 id="playground-title">Interactive playground</h2>
            </div>
            <p>
              Pick a source, search the live catalogs, choose a color, then inspect
              the exact value your application stores.
            </p>
            <a className="section-link" href={`${import.meta.env.BASE_URL}explorer/`}>
              Launch full-page explorer
            </a>
          </div>

          <div className="playground-grid">
            <div className="picker-stage">
              <IconPicker
                value={selectedIcon}
                onChange={setSelectedIcon}
                color={color}
                onColorChange={setColor}
                ariaLabel="Demo icon picker"
              />
            </div>

            <div className="selection-panel">
              <div className="selection-preview">
                <IconRenderer
                  value={selectedIcon}
                  size={64}
                  color={color}
                  fallback={<span className="fallback-glyph">?</span>}
                />
              </div>

              <div className="selection-details">
                <span className="detail-label">Stored value</span>
                <output>{serialized}</output>
                <span className="detail-label">Parsed object</span>
                <pre>{JSON.stringify(parsed, null, 2)}</pre>
                <span className="detail-label">Provider URL</span>
                <code className="url-value">
                  {parsed ? getIconUrl(parsed, color) ?? 'Rendered locally' : '—'}
                </code>
              </div>

              <fieldset className="color-control">
                <legend>Preview color</legend>
                <div>
                  {COLORS.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className={color === swatch ? 'selected' : undefined}
                      style={{ backgroundColor: swatch }}
                      aria-label={`Use ${swatch}`}
                      aria-pressed={color === swatch}
                      onClick={() => setColor(swatch)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="trigger-examples">
                <span className="detail-label">Portal trigger sizes</span>
                <div>
                  {(['sm', 'md', 'lg'] as const).map((size) => (
                    <IconPickerButton
                      key={size}
                      size={size}
                      value={selectedIcon}
                      onChange={setSelectedIcon}
                      color={color}
                      onColorChange={setColor}
                      label={`Open ${size} icon picker`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="providers" aria-labelledby="providers-title">
          <div className="section-heading">
            <div>
              <span className="section-number">02</span>
              <h2 id="providers-title">Every provider, one renderer</h2>
            </div>
            <p>
              Select any card to send its portable value back into the playground.
            </p>
          </div>

          <div className="provider-grid">
            {PROVIDERS.map((provider) => (
              <button
                type="button"
                className="provider-card"
                key={provider.value}
                onClick={() => {
                  setSelectedIcon(provider.value);
                  setColor(provider.accent);
                }}
                aria-label={`Use ${provider.name} icon ${provider.value}`}
              >
                <span
                  className="provider-icon"
                  style={
                    { '--provider-accent': provider.accent } as React.CSSProperties
                  }
                >
                  <IconRenderer
                    value={provider.value}
                    size={36}
                    color={provider.value.startsWith('dash:') ? undefined : provider.accent}
                    label=""
                    fallback={<span className="fallback-glyph">?</span>}
                  />
                </span>
                <span>
                  <strong>{provider.name}</strong>
                  <small>{provider.description}</small>
                </span>
                <code>{provider.value}</code>
              </button>
            ))}
          </div>
        </section>

        <section className="section" id="contract" aria-labelledby="contract-title">
          <div className="section-heading">
            <div>
              <span className="section-number">03</span>
              <h2 id="contract-title">Storage contract, decoded</h2>
            </div>
            <p>
              The core helpers are framework-free and retain legacy bare Lucide
              names without a database migration.
            </p>
          </div>

          <div className="contract-layout">
            <div className="contract-table" role="table" aria-label="Core parsing examples">
              <div className="contract-row contract-header" role="row">
                <span role="columnheader">Input</span>
                <span role="columnheader">Source</span>
                <span role="columnheader">Name</span>
                <span role="columnheader">Serialized</span>
              </div>
              {STORAGE_EXAMPLES.map((value) => {
                const result = parseIconValue(value);
                return (
                  <div className="contract-row" role="row" key={value}>
                    <code role="cell">{value}</code>
                    <span role="cell">{result?.source ?? '—'}</span>
                    <span role="cell">{result?.name ?? '—'}</span>
                    <code role="cell">
                      {result ? serializeIconValue(result) : 'null'}
                    </code>
                  </div>
                );
              })}
            </div>

            <div className="code-card">
              <div className="code-card-header">
                <span>core.ts</span>
                <span>Zero React runtime</span>
              </div>
              <pre>
                <code>{`import {
  parseIconValue,
  serializeIconValue
} from '@rsocko/icon-picker/core'

const parsed = parseIconValue('rocket')
// { source: 'lucide', name: 'rocket' }

serializeIconValue(parsed)
// 'lucide:rocket'`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="section" id="network" aria-labelledby="network-title">
          <div className="section-heading">
            <div>
              <span className="section-number">04</span>
              <h2 id="network-title">Network-aware by design</h2>
            </div>
            <div className={online ? 'network-badge online' : 'network-badge offline'}>
              <span />
              Browser is {online ? 'online' : 'offline'}
            </div>
          </div>

          <div className="state-grid">
            <article className="state-card">
              <div className="state-preview loading-preview" aria-hidden="true">
                <span className="demo-spinner" />
                <span>Searching providers…</span>
              </div>
              <h3>Loading</h3>
              <p>Remote search announces progress while local emoji stays responsive.</p>
            </article>
            <article className="state-card">
              <div className="state-preview" aria-hidden="true">
                <span className="empty-mark">0</span>
                <span>No results for “impossible-query”</span>
              </div>
              <h3>Empty</h3>
              <p>Search for a nonsense phrase above to exercise the real empty state.</p>
            </article>
            <article className="state-card">
              <div className="state-preview error-preview">
                <IconRenderer
                  value="lucide:../unsafe"
                  size={28}
                  fallback={<span className="fallback-glyph">!</span>}
                />
                <span>Provider unavailable</span>
              </div>
              <h3>Error and offline</h3>
              <p>
                Unsafe URLs and failed images use fallbacks; catalog failures retain
                built-in popular icons.
              </p>
            </article>
          </div>

          <div className="network-notes">
            <div>
              <h3>Client-side requests only</h3>
              <p>
                Search text is sent from this browser to Iconify. Catalogs and SVGs
                come from Iconify, jsDelivr, and Simple Icons. There are no API keys,
                cookies, database calls, or demo services.
              </p>
            </div>
            <div>
              <h3>CSP, CORS, and offline use</h3>
              <p>
                This static page declares the required CSP origins. Provider fetches
                depend on their CORS policies and availability. Offline, native emoji
                and built-in lists remain browsable while remote SVGs may fall back.
              </p>
            </div>
          </div>
        </section>

        <section className="section accessibility-section" aria-labelledby="accessibility-title">
          <div>
            <span className="section-number">05</span>
            <h2 id="accessibility-title">Keyboard first, screen-reader ready</h2>
            <p>
              Native controls, visible focus, pressed states, dialog semantics, focus
              containment, Escape handling, and polite result announcements are built
              into the components.
            </p>
          </div>
          <dl className="key-list">
            <div><dt>Tab</dt><dd>Move through sources, colors, and icons</dd></div>
            <div><dt>Enter / Space</dt><dd>Select filters, swatches, and values</dd></div>
            <div><dt>Esc</dt><dd>Close a portal picker and restore trigger focus</dd></div>
          </dl>
        </section>
      </main>

      <footer>
        <p>Built entirely as static files from the package source.</p>
        <div>
          <a href="https://github.com/rsocko/icon-picker">GitHub</a>
          <a href="https://github.com/rsocko/icon-picker/blob/main/README.md">
            Documentation
          </a>
          <a href="https://github.com/rsocko/icon-picker/blob/main/THIRD_PARTY_NOTICES.md">
            Provider notices
          </a>
        </div>
      </footer>
    </div>
  );
}
