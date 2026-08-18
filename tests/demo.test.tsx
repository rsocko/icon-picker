import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Demo } from '../demo/src/Demo';

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.includes('tree.json')) return Promise.resolve(response({ svg: [] }));
    if (url.includes('simple-icons.json')) return Promise.resolve(response([]));
    return Promise.resolve(response({ icons: [] }));
  });
});

describe('static demo', () => {
  it('shows the interactive package surfaces and provider disclosures', () => {
    render(<Demo />);

    expect(
      screen.getByRole('heading', { name: 'Interactive playground' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Every provider, one renderer' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Storage contract, decoded' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Client-side requests only')).toBeInTheDocument();
    expect(screen.getByText('CSP, CORS, and offline use')).toBeInTheDocument();
  });

  it('updates the portable value from every-provider cards', () => {
    render(<Demo />);
    const selectedValue = screen.getByTestId('selected-value');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Use Material icon mdi:home-variant',
      }),
    );
    expect(selectedValue).toHaveTextContent('mdi:home-variant');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Use Simple Icons icon si:github',
      }),
    );
    expect(selectedValue).toHaveTextContent('si:github');
  });

  it('documents bare Lucide compatibility in the rendered contract', () => {
    render(<Demo />);
    const legacyRow = screen.getAllByRole('row').find((row) => {
      const firstCell = within(row).queryAllByRole('cell')[0];
      return firstCell?.textContent === 'rocket';
    });
    expect(legacyRow).toBeDefined();
    expect(legacyRow).toHaveTextContent('lucide');
    expect(legacyRow).toHaveTextContent('lucide:rocket');
  });
});
