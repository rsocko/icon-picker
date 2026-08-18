import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerPage } from '../demo/src/ExplorerPage';

const writeText = vi.fn<(value: string) => Promise<void>>();

function response(body: unknown, text = ''): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(text),
  } as unknown as Response;
}

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.endsWith('.svg?color=%23ffffff')) {
      return Promise.resolve(
        response(null, '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>'),
      );
    }
    if (url.includes('tree.json')) return Promise.resolve(response({ svg: [] }));
    if (url.includes('simple-icons.json')) {
      return Promise.resolve(
        response([{ title: '.NET' }, { title: 'Rocket.Chat' }, { title: 'GitHub' }]),
      );
    }
    if (url.includes('/search?')) {
      const searchUrl = new URL(url);
      const icons =
        searchUrl.searchParams.get('query') === 'home' &&
        searchUrl.searchParams.get('prefix') === 'lucide'
          ? ['lucide:home']
          : [];
      return Promise.resolve(response({ icons }));
    }
    return Promise.resolve(response({ icons: [] }));
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});

describe('full-page explorer', () => {
  it('renders all providers and dense copy controls', () => {
    render(<ExplorerPage />);
    expect(screen.getByRole('heading', { name: 'Emoji' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lucide' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'MDI' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Phosphor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Simple Icons' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'React' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'lg' })).toBeInTheDocument();
  });

  it('copies the selected format and announces success', async () => {
    render(<ExplorerPage />);
    fireEvent.click(screen.getByRole('button', { name: 'URL' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy lucide:home as url' }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'https://api.iconify.design/lucide/home.svg?color=%23ffffff',
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Copied url');
  });

  it('fetches and copies SVG markup for the SVG format', async () => {
    render(<ExplorerPage />);
    fireEvent.click(screen.getByRole('button', { name: 'SVG' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy lucide:home as svg' }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>',
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Copied svg');
  });

  it('supports the search shortcut and empty state', async () => {
    render(<ExplorerPage />);
    const search = screen.getByRole('searchbox', { name: 'Search icons' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(search).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Lucide' }));
    fireEvent.change(search, { target: { value: 'nothing-can-match-this-987' } });
    expect(
      await screen.findByText('No results for “nothing-can-match-this-987”.'),
    ).toBeInTheDocument();
  });

  it('clears stale results as soon as the query changes', async () => {
    render(<ExplorerPage />);
    const search = screen.getByRole('searchbox', { name: 'Search icons' });
    fireEvent.change(search, { target: { value: 'home' } });
    expect(
      await screen.findByRole('button', { name: 'Copy lucide:home as name' }),
    ).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'new-query' } });
    expect(
      screen.queryByRole('button', { name: 'Copy lucide:home as name' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Searching providers…')).toBeInTheDocument();
  });

  it('uses canonical Simple Icons slugs for special characters', async () => {
    render(<ExplorerPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Simple Icons' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search icons' }), {
      target: { value: 'dotnet' },
    });

    const result = await screen.findByRole('button', {
      name: 'Copy si:dotnet as name',
    });
    fireEvent.click(result);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('si:dotnet'));
  });

  it('does not apply provider shortcuts while editing the custom color', () => {
    render(<ExplorerPage />);
    const customColor = screen.getByRole('textbox', {
      name: 'Custom six-digit hex color',
    });
    fireEvent.keyDown(customColor, { key: '1' });
    expect(screen.getByRole('button', { name: 'Emoji' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
