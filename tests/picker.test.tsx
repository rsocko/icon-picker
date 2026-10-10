import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconPicker } from '../src/IconPicker';
import { IconPickerButton } from '../src/IconPickerButton';
import type { IconPickerStyle } from '../src/types';

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function mockCatalogs() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = requestUrl(input);
    if (url.includes('tree.json')) return Promise.resolve(jsonResponse({ svg: [] }));
    if (url.includes('collection?prefix=simple-icons')) {
      return Promise.resolve(jsonResponse({ uncategorized: [] }));
    }
    return Promise.resolve(jsonResponse({ icons: [] }));
  });
}

describe('IconPicker', () => {
  it('inherits the host color scheme by default', async () => {
    mockCatalogs();
    const { container } = render(
      <div style={{ colorScheme: 'dark' }}>
        <IconPicker value={null} onChange={vi.fn()} />
      </div>,
    );

    await waitFor(() =>
      expect(container.querySelector('.rs-icon-picker')).toHaveAttribute(
        'data-rs-icon-picker-theme',
        'dark',
      ),
    );
  });

  it.each(['light', 'dark'] as const)(
    'supports an explicit %s theme override',
    async (theme) => {
      mockCatalogs();
      const { container } = render(
        <div style={{ colorScheme: theme === 'light' ? 'dark' : 'light' }}>
          <IconPicker value={null} onChange={vi.fn()} theme={theme} />
        </div>,
      );

      await waitFor(() =>
        expect(container.querySelector('.rs-icon-picker')).toHaveAttribute(
          'data-rs-icon-picker-theme',
          theme,
        ),
      );
    },
  );

  it('accepts typed semantic style overrides', () => {
    mockCatalogs();
    const { container } = render(
      <IconPicker
        value={null}
        onChange={vi.fn()}
        style={{
          '--rs-icon-picker-bg': '#101820',
          '--rs-icon-picker-accent': '#ffb000',
        }}
      />,
    );

    expect(container.querySelector('.rs-icon-picker')).toHaveStyle({
      '--rs-icon-picker-bg': '#101820',
      '--rs-icon-picker-accent': '#ffb000',
    });
  });

  it('selects a popular emoji using an accessible button', () => {
    mockCatalogs();
    const onChange = vi.fn();
    render(<IconPicker value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select emoji 🚀' }));
    expect(onChange).toHaveBeenCalledWith('🚀');
  });

  it('filters sources and selects a provider icon', () => {
    mockCatalogs();
    const onChange = vi.fn();
    render(<IconPicker value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lucide' }));
    expect(screen.getByRole('button', { name: 'Lucide' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('heading', { name: 'Emoji' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select lucide:rocket' }));
    expect(onChange).toHaveBeenCalledWith('lucide:rocket');
  });

  it('exposes color swatches as pressed buttons', () => {
    mockCatalogs();
    const onColorChange = vi.fn();
    render(
      <IconPicker
        value={null}
        onChange={vi.fn()}
        color="#3b82f6"
        onColorChange={onColorChange}
      />,
    );

    const blue = screen.getByRole('button', {
      name: 'Set icon color to #3b82f6',
    });
    expect(blue).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(
      screen.getByRole('button', { name: 'Set icon color to #10b981' }),
    );
    expect(onColorChange).toHaveBeenCalledWith('#10b981');
  });

  it('uses unique heading relationships for multiple embedded pickers', () => {
    mockCatalogs();
    render(
      <>
        <IconPicker value={null} onChange={vi.fn()} />
        <IconPicker value={null} onChange={vi.fn()} />
      </>,
    );

    const emojiHeadings = screen.getAllByRole('heading', { name: 'Emoji' });
    expect(emojiHeadings[0]?.id).not.toBe(emojiHeadings[1]?.id);
    for (const heading of emojiHeadings) {
      expect(heading.closest('section')?.getAttribute('aria-labelledby')).toBe(
        heading.id,
      );
    }
  });

  it('loads the current top-level Simple Icons catalog shape', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes('tree.json')) return Promise.resolve(jsonResponse({ svg: [] }));
      if (url.includes('collection?prefix=simple-icons')) {
        return Promise.resolve(
          jsonResponse({ uncategorized: ['acmeunique'] }),
        );
      }
      return Promise.resolve(jsonResponse({ icons: [] }));
    });
    render(<IconPicker value={null} onChange={vi.fn()} searchDebounceMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'Brands' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search icons' }), {
      target: { value: 'acmeunique' },
    });

    expect(
      await screen.findByRole('button', { name: 'Select si:acmeunique' }),
    ).toBeInTheDocument();
  });

  it('shows loading and empty search states', async () => {
    let resolveSearch: ((value: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes('tree.json')) return Promise.resolve(jsonResponse({ svg: [] }));
      if (url.includes('collection?prefix=simple-icons')) {
        return Promise.resolve(jsonResponse({ uncategorized: [] }));
      }
      return new Promise<Response>((resolve) => {
        resolveSearch = resolve;
      });
    });
    render(<IconPicker value={null} onChange={vi.fn()} searchDebounceMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lucide' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search icons' }), {
      target: { value: 'no-match' },
    });

    expect(await screen.findByText('Searching...')).toBeInTheDocument();
    resolveSearch?.(jsonResponse({ icons: [] }));
    expect(await screen.findByText('No results for "no-match".')).toBeInTheDocument();
  });

  it('reports provider errors and offers retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes('tree.json')) return Promise.resolve(jsonResponse({ svg: [] }));
      if (url.includes('collection?prefix=simple-icons')) {
        return Promise.resolve(jsonResponse({ uncategorized: [] }));
      }
      return Promise.reject(new Error('offline'));
    });
    render(<IconPicker value={null} onChange={vi.fn()} searchDebounceMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lucide' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search icons' }), {
      target: { value: 'rocketship' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'One provider is temporarily unavailable.',
    );
    expect(screen.getByRole('button', { name: 'Retry providers' })).toBeInTheDocument();
  });

  it('renders Iconify aliases from a batched icon-set request', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes('tree.json')) return Promise.resolve(jsonResponse({ svg: [] }));
      if (url.includes('collection?prefix=simple-icons')) {
        return Promise.resolve(jsonResponse({ uncategorized: [] }));
      }
      if (url.includes('/lucide.json?')) {
        return Promise.resolve(
          jsonResponse({
            width: 24,
            height: 24,
            icons: {
              house: { body: '<path d="M3 11 12 2l9 9v11H3z"/>' },
            },
            aliases: { home: { parent: 'house' } },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ icons: [] }));
    });

    render(<IconPicker value={null} onChange={vi.fn()} />);
    const alias = await screen.findByRole('img', { name: 'lucide:home' });
    expect(alias.style.maskImage).toContain(
      encodeURIComponent('M3 11 12 2l9 9v11H3z'),
    );
  });
});

describe('IconPickerButton', () => {
  function setViewport(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: height,
    });
  }

  function mockTriggerRect(rect: Partial<DOMRect>) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 540,
      height: 40,
      left: 900,
      right: 964,
      top: 500,
      width: 64,
      x: 900,
      y: 500,
      toJSON: () => ({}),
      ...rect,
    });
  }

  it('opens a dialog, selects an icon, and restores focus', async () => {
    mockCatalogs();
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <IconPickerButton
        value={null}
        onChange={onChange}
        onOpenChange={onOpenChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Pick an icon' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Choose an icon' })).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Select emoji 🚀' }));
    expect(onChange).toHaveBeenCalledWith('🚀');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('propagates the host theme and semantic variables into its portal', async () => {
    mockCatalogs();
    render(
      <div
        className="dark"
        style={{
          '--rs-icon-picker-bg': '#161b22',
          '--rs-icon-picker-accent': '#58a6ff',
        } as IconPickerStyle}
      >
        <IconPickerButton value={null} onChange={vi.fn()} />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pick an icon' }));
    const popover = screen.getByRole('dialog', { name: 'Choose an icon' })
      .parentElement;

    await waitFor(() =>
      expect(popover).toHaveAttribute('data-rs-icon-picker-theme', 'dark'),
    );
    expect(popover).toHaveStyle({
      '--rs-icon-picker-bg': '#161b22',
      '--rs-icon-picker-accent': '#58a6ff',
    });
  });

  it('closes on Escape and does not open when disabled', () => {
    mockCatalogs();
    const { rerender } = render(
      <IconPickerButton value={null} onChange={vi.fn()} />,
    );
    const trigger = screen.getByRole('button', { name: 'Pick an icon' });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<IconPickerButton value={null} onChange={vi.fn()} disabled />);
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses the viewport as an overlay when neither side is usable', () => {
    mockCatalogs();
    setViewport(360, 300);
    mockTriggerRect({
      bottom: 170,
      left: 280,
      right: 344,
      top: 130,
      x: 280,
      y: 130,
    });

    render(<IconPickerButton value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick an icon' }));

    expect(screen.getByRole('dialog', { name: 'Choose an icon' }).parentElement).toHaveStyle({
      height: '284px',
      left: '8px',
      top: '8px',
      width: '344px',
      visibility: 'visible',
    });
  });

  it('repositions and resizes while open', () => {
    mockCatalogs();
    setViewport(1200, 800);
    mockTriggerRect({
      bottom: 140,
      left: 100,
      right: 164,
      top: 100,
      x: 100,
      y: 100,
    });

    render(<IconPickerButton value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick an icon' }));
    const popover = screen.getByRole('dialog', { name: 'Choose an icon' })
      .parentElement;
    expect(popover).toHaveStyle({ height: '520px', left: '100px', top: '144px' });

    setViewport(1200, 400);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(popover).toHaveStyle({ height: '248px', left: '100px', top: '144px' });
  });
});
