import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IconPicker } from '../src/IconPicker';
import { IconPickerButton } from '../src/IconPickerButton';

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
    if (url.includes('simple-icons.json')) {
      return Promise.resolve(jsonResponse([]));
    }
    return Promise.resolve(jsonResponse({ icons: [] }));
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('IconPicker', () => {
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
      if (url.includes('simple-icons.json')) {
        return Promise.resolve(
          jsonResponse([{ slug: 'acmeunique', title: 'Acme Unique' }]),
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
      if (url.includes('simple-icons.json')) {
        return Promise.resolve(jsonResponse([]));
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
      if (url.includes('simple-icons.json')) {
        return Promise.resolve(jsonResponse([]));
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
});

describe('IconPickerButton', () => {
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
});
