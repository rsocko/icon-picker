import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconRenderer } from '../src/IconRenderer';

describe('IconRenderer', () => {
  it('renders the fallback for an empty value', () => {
    render(<IconRenderer value={null} fallback={<span>Nothing selected</span>} />);
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
  });

  it('renders emoji with an accessible label', () => {
    render(<IconRenderer value="🚀" size={24} />);
    expect(screen.getByRole('img', { name: 'Emoji: 🚀' })).toHaveStyle({
      width: '24px',
      height: '24px',
    });
  });

  it('renders provider icons with a safe URL and can be decorative', () => {
    const { container } = render(
      <IconRenderer value="lucide:rocket" color="#3b82f6" label="" />,
    );
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute(
      'src',
      'https://api.iconify.design/lucide/rocket.svg?color=%233b82f6',
    );
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('shows a fallback on error and recovers when the value changes', () => {
    const { rerender } = render(
      <IconRenderer value="lucide:rocket" fallback={<span>Unavailable</span>} />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'lucide icon: rocket' }));
    expect(screen.getByText('Unavailable')).toBeInTheDocument();

    rerender(
      <IconRenderer value="mdi:home" fallback={<span>Unavailable</span>} />,
    );
    expect(screen.getByRole('img', { name: 'mdi icon: home' })).toBeInTheDocument();
  });

  it('uses the fallback for an unsafe provider value', () => {
    render(
      <IconRenderer
        value="lucide:../secret"
        fallback={<span>Invalid icon</span>}
      />,
    );
    expect(screen.getByText('Invalid icon')).toBeInTheDocument();
  });
});
